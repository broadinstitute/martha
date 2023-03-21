const {
    convertToMarthaV3Response,
    makeLogSafeRequestError,
    BadRequestError,
    RemoteServerError,
    logAndSendBadRequest,
    logAndSendServerError,
    delay,
} = require('../common/helpers');

const {
    MARTHA_V3_DEFAULT_FIELDS,
    MARTHA_V3_ALL_FIELDS,
} = require("./martha_fields");

const {
    determineDrsProvider,
    DrsProvider,
    AccessUrlAuth
} = require("./drs_providers");

const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

const config = require('../common/config');
const apiAdapter = require('../common/api_adapter');
const url = require('url');
const mask = require('json-mask');

const PROTOCOL_PREFIX_DRS='/ga4gh/drs/v1/objects';

// CIB URIs via https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit#
const DG_COMPACT_BDC_PROD = 'dg.4503';
const DG_COMPACT_BDC_STAGING = 'dg.712c';
const DG_COMPACT_THE_ANVIL = 'dg.anv0';
const DRS_COMPACT_THE_ANVIL = 'drs.anv0';
const DG_COMPACT_CRDC = 'dg.4dfc';
const DG_COMPACT_KIDS_FIRST = 'dg.f82a1a';
const DG_COMPACT_PASSPORT_TEST = 'dg.test0';

// Google Cloud Functions gives us 60 seconds to respond. We'll use most of it to fetch what we can,
// but not fail if we happen to time out when fetching a signed URL takes too long.
let pencilsDownSeconds = 58;

// For tests that need to probe the behavior near the limit of the Cloud Function timeout, we don't
// want to have to wait 60 seconds.
const overridePencilsDownSeconds = (seconds) => {
    pencilsDownSeconds = seconds;
};

const secretManagerServiceClient = new SecretManagerServiceClient();

async function getSecret(name) {
    const [version] = await secretManagerServiceClient.accessSecretVersion({
        name: name,
    });

    // Extract the payload as a string.
    return version.payload.data.toString();
}

/**
 * Returns the first access method in `drsProvider.accessMethodTypes()` with a type that matches the type of an access
 * method in `drsResponse`, otherwise `undefined`.
 */
function getAccessMethod(drsResponse, drsProvider) {
    if (!drsResponse || !drsResponse.access_methods) {
        return;
    }

    for (const accessMethodType of drsProvider.accessMethodTypes()) {
        for (const accessMethod of drsResponse.access_methods) {
            if (accessMethod.type === accessMethodType) {
                return accessMethod;
            }
        }
    }
}

function getPathFileName(path) {
    return path && path.replace(/^.*[\\/]/, '');
}

function getUrlFileName(url) {
    return url && getPathFileName(new URL(url).pathname);
}

/**
 * Attempts to return the file name using only the drsResponse.
 *
 * It is possible the name may need to be retrieved from the signed url.
 */
function getDrsFileName(drsResponse) {
    if (!drsResponse) {
        return;
    }

    const { name, access_methods } = drsResponse;

    if (name) {
        return name;
    }

    if (access_methods && access_methods[0] && access_methods[0].access_url) {
        return getUrlFileName(access_methods[0].access_url.url);
    }
}

function getLocalizationPath(drsProvider, drsResponse) {
    if (drsProvider.usesAliasesForLocalizationPath() && drsResponse && Array.isArray(drsResponse.aliases)) {
        return drsResponse.aliases[0];
    }
}

/** *************************************************************************************************
 * URI parsers
 */

/**
 * Expands a CIB DRS URI host to a W3C/IETF URI hostname.
 */
function expandCibHost(cibHost) {
    switch (cibHost.toLowerCase()) {
        case DG_COMPACT_BDC_PROD: return config.bioDataCatalystProdHost;
        case DG_COMPACT_BDC_STAGING: return config.bioDataCatalystStagingHost;
        case DG_COMPACT_THE_ANVIL: return config.theAnvilHost;
        case DRS_COMPACT_THE_ANVIL: return config.terraDataRepoHost;
        case DG_COMPACT_CRDC: return config.crdcHost;
        case DG_COMPACT_KIDS_FIRST: return config.kidsFirstHost;
        case DG_COMPACT_PASSPORT_TEST: return config.passportTestHost;
        default:
            throw new BadRequestError(`Unrecognized Compact Identifier Based host '${cibHost}'.`);
    }
}

/**
 * Custom suffix generation using the first linked document then falling back to the spec:
 * - https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit
 * - https://ga4gh.github.io/data-repository-service-schemas/preview/release/drs-1.1.0/docs/#_compact_identifier_based_drs_uris
 */
function concatCibSuffix(cibHost, cibSuffix) {
    switch (cibHost.toLowerCase()) {
        // Specs? We don't need no stinkin' specs!
        case DG_COMPACT_BDC_PROD:
        case DG_COMPACT_BDC_STAGING:
        case DG_COMPACT_THE_ANVIL:
            return `${cibHost}/${cibSuffix}`;
        default:
            // Following the spec and only returning the suffix
            return cibSuffix;
    }
}

/**
 * Expands a CIB DRS URI host to a W3C/IETF URI hostname.
 *
 * Official spec that is only used sometimes:
 * https://ga4gh.github.io/data-repository-service-schemas/preview/release/drs-1.1.0/docs/#_compact_identifier_based_drs_uris
 *
 * Takes into account the specification exceptions that are used IRL:
 * https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit?pli=1#heading=h.hrp7xfocdccz
 */
function expandCibSuffix(cibHost, cibSuffix, cibSeparator) {
    const suffix = concatCibSuffix(cibHost, cibSuffix);
    /*
    If the separator is a `/`, leave it a slash. Otherwise, encode the slashes as `%2F`.

    Search for `%2F` in the Nov 4 version of this doc:
    - https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit?pli=1#heading=h.hrp7xfocdccz
     */
    return cibSeparator === '/' ? suffix : encodeURIComponent(suffix);
}

/**
 * Returns the url parts of the DOS or DRS url.
 */
function getHttpsUrlParts(url) {
    /*
    DOS or DRS schemes are allowed as of AZUL-702
    https://ucsc-cgl.atlassian.net/browse/AZUL-702
     */

    /*
    The many, many forms of Compact Identifier-based (CIB) DRS URIs to W3C/IETF HTTPS URL conversion:
    - https://ga4gh.github.io/data-repository-service-schemas/preview/release/drs-1.1.0/docs/#_compact_identifier_based_drs_uris
    - https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit
    - https://broadworkbench.atlassian.net/browse/BT-4?focusedCommentId=35980
    - etc.

    Note: GA4GH CIB URIs are incompatible with W3C/IETF URIs and the various standard libraries that parse them:
    - https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Definition
    - https://tools.ietf.org/html/rfc3986
    - https://cr.openjdk.java.net/~dfuchs/writeups/updating-uri/
    - etc.

    Additionally, there are previous non-CIB DOS/DRS URIs that *are* compatible with W3C/IETF URIs format too.
    Instead of encoding the `/` in the protocol suffix to `%2F` they seem to pass it through just as a `/` in the
    HTTPS URL.

    AnVIL has added a new CID drs.anv0 for data hosted in TDR, see doc here: https://docs.google.com/document/d/1aKlgpmgiK66Y_QV5Tj2LJugJkzSa0EXrubFUg3TGhhs/edit#heading=h.4fw3nl9lcepm

    If you update *any* of the below be sure to link to the supporting docs and update the comments above!
     */

    // The many different ways a DOS/DRS may be "compact", in the order that they should be tried
    const cibRegExps = [
        // Non-W3C CIB DOS/DRS URIs, where the `dg.abcd` appears more than once
        /(?:dos|drs):\/\/(?<host>(dg|drs)\.[0-9a-z-]+)(?<separator>:)\k<host>\/(?<suffix>[^?]*)(?<query>\?(.*))?/i,
        // Non-W3C CIB DOS/DRS URIs, where the `dg.abcd` is only mentioned once
        /(?:dos|drs):\/\/(?<host>(dg|drs)\.[0-9a-z-]+)(?<separator>:)(?<suffix>[^?]*)(?<query>\?(.*))?/i,
        // W3C compatible using a slash separator
        /(?:dos|drs):\/\/(?<host>(dg|drs)\.[0-9a-z-]+)(?<separator>\/)(?<suffix>[^?]*)(?<query>\?(.*))?/i,
    ];

    const cibRegExp = cibRegExps.find((cibRegExp) => cibRegExp.exec(url));
    if (cibRegExp) {
        const cibMatch = cibRegExp.exec(url);
        return {
            httpsUrlHost: expandCibHost(cibMatch.groups.host),
            protocolSuffix:
                expandCibSuffix(
                    cibMatch.groups.host,
                    cibMatch.groups.suffix,
                    cibMatch.groups.separator,
                ),
            httpsUrlSearch: cibMatch.groups.query,
            // See `determineDrsProvider` for more info on this `martha_v2` backwards compatibility
            httpsUrlMaybeNotBdc:
                ![DG_COMPACT_BDC_PROD, DG_COMPACT_BDC_STAGING].includes(cibMatch.groups.host.toLowerCase()),
        };
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch (error) {
        throw new BadRequestError(error.message);
    }
    if (!parsedUrl.hostname || !parsedUrl.pathname) {
        throw new BadRequestError(`"${url}" is missing a host and/or a path.`);
    }
    return {
        httpsUrlHost: parsedUrl.hostname,
        httpsUrlPort: parsedUrl.port,
        protocolSuffix: parsedUrl.pathname.slice(1),
        httpsUrlSearch: parsedUrl.search,
    };
}

// NOTE: reimplementation of dataObjectUriToHttps in helper.js
function generateMetadataUrl(drsProvider, urlParts) {
    // Construct a WHATWG URL by first only setting the protocol and the hostname: https://github.com/whatwg/url/issues/354
    const generatedUrl = new URL(`https://${urlParts.httpsUrlHost}`);
    generatedUrl.port = urlParts.httpsUrlPort;
    generatedUrl.pathname = `${PROTOCOL_PREFIX_DRS}/${urlParts.protocolSuffix}`;
    if (urlParts.httpsUrlSearch) {
        generatedUrl.search = urlParts.httpsUrlSearch;
    }
    return url.format(generatedUrl);
}

function generateAccessUrl(drsProvider, urlParts, accessId) {
    // Construct a WHATWG URL by first only setting the protocol and the hostname: https://github.com/whatwg/url/issues/354
    const generatedUrl = new URL(`https://${urlParts.httpsUrlHost}`);
    generatedUrl.port = urlParts.httpsUrlPort;
    generatedUrl.pathname = `${PROTOCOL_PREFIX_DRS}/${urlParts.protocolSuffix}/access/${accessId}`;
    if (urlParts.httpsUrlSearch) {
        generatedUrl.search = urlParts.httpsUrlSearch;
    }
    return url.format(generatedUrl);
}

/** *************************************************************************************************
 * Response parsers
 */

function responseParser (response) {
    // If this is not a DOS response, assume it's already DRS and return it.
    if (!response || !response.data_object) { return response; }

    // Otherwise, find the DOS fields and convert them to DRS.
    const {
        urls,
        checksums,
        created: created_time,
        mimeType: mime_type,
        name,
        size,
        updated: updated_time,
    } = response.data_object;
    const access_methods =
        urls &&
        urls
            .filter((e) => e.url.startsWith('gs://'))
            .map((gsUrl) => { return { type: 'gs', access_url: { url: gsUrl.url } }; });
    return { access_methods, checksums, created_time, mime_type, name, size, updated_time };
}

function validateRequest(url, auth, requestedFields) {
    if (!url) {
        throw new BadRequestError(`'url' is missing.`);
    }

    if (!auth) {
        throw new BadRequestError('Authorization header is missing.');
    }

    if (!Array.isArray(requestedFields)) {
        throw new BadRequestError(`'fields' was not an array.`);
    }

    const invalidFields = requestedFields.filter((field) => !MARTHA_V3_ALL_FIELDS.includes(field));
    if (invalidFields.length !== 0) {
        throw new BadRequestError(
            `Fields '${invalidFields.join("','")}' are not supported. ` +
            `Supported fields are '${MARTHA_V3_ALL_FIELDS.join("', '")}'.`
        );
    }
}

function buildRequestInfo(params) {
    const {
        url,
        requestedFields,
        auth,
        forceAccessUrl,
    } = params;

    validateRequest(url, auth, requestedFields);
    const urlParts = getHttpsUrlParts(url);

    const drsProvider = determineDrsProvider(url, urlParts, forceAccessUrl);
    Object.setPrototypeOf(drsProvider, DrsProvider.prototype);

    Object.assign(params, {
        drsProvider,
        urlParts,
    });
}

/**
 * Retrieves information from the various underlying servers.
 *
 * See also:
 * - https://bvdp-saturn-dev.appspot.com/#workspaces/general-dev-billing-account/DRS%20and%20Signed%20URL%20Development%20-%20Dev
 * - https://lucid.app/lucidchart/invitations/accept/0f899643-76a9-4b9c-84f5-f11ddac86bba
 * - https://lucid.app/lucidchart/invitations/accept/8b6f942b-f7dc-4acc-ac36-318a1685e6ac
 */
async function retrieveFromServers(params) {
    const {
        requestedFields,
        auth,
        drsProvider,
        url,
        urlParts
    } = params;

    const {sendMetadataAuth, bondProvider} = drsProvider;

    // TODO: figure out JSON logging for Martha (and Bond), the multiline logging situation is a mess.
    // e.g. any stack traces for Martha / Bond appear as one log entry per frame
    console.log(
        `DRS URI '${url}' will use DRS provider:\n${JSON.stringify(drsProvider, null, 2)}`
    );
    console.log(`Requested martha_v3 fields: ${requestedFields.join(", ")}`);

    let bondSA;
    let drsResponse;
    let accessMethod;
    let fileName;
    let localizationPath;
    let accessUrl;
    let passports;

    // `fetch` below might time out in a way that we want to report as an error. Since the timeout
    // interrupts us while we're waiting for a response, we need to capture what we were about to
    // try doing just before we do it so that we can provide that detail in the error report.
    let hypotheticalErrorMessage;

    const getAccessUrl = async (accessUrlAuth, httpsAccessUrl, accessToken, auth) => {
        switch (accessUrlAuth) {
            case AccessUrlAuth.PASSPORT:
                if (passports) {
                    try {
                        let clientCert, clientPrivateKey;
                        if (drsProvider.clientCertSecretName && drsProvider.clientPrivateKeySecretName) {
                            clientPrivateKey = await getSecret(drsProvider.clientPrivateKeySecretName);
                            clientCert = await getSecret(drsProvider.clientCertSecretName);
                        }
                        return await apiAdapter.postJsonTo(httpsAccessUrl, null, {passports}, clientPrivateKey, clientCert);
                    } catch (error) {
                        console.log(`Passport authorized request failed for ${httpsAccessUrl} with error ${error}`);
                    }
                }
                // if we made it this far, there are no passports or there was an error using them so return nothing.
                return;

            case AccessUrlAuth.CURRENT_REQUEST:
                return apiAdapter.getJsonFrom(httpsAccessUrl, auth);

            case AccessUrlAuth.FENCE_TOKEN:
                if (accessToken) {
                    return apiAdapter.getJsonFrom(httpsAccessUrl, `Bearer ${accessToken}`);
                } else {
                    throw new BadRequestError(`Fence access token required for ${httpsAccessUrl} but is missing. Does use have an account linked in Bond?`);
                }

            default:
                throw new BadRequestError(
                    `Programmer error: 'determineAccessUrlAuth' called with AccessUrlAuth.${accessUrlAuth} for provider ${this.providerName}`);
        }
    };

    const maybeFetchFenceAccessToken = async (accessMethod, useFallbackAuth) => {
        if (drsProvider.shouldFetchFenceAccessToken(accessMethod, requestedFields, useFallbackAuth)) {
            try {
                const bondAccessTokenUrl = `${config.bondBaseUrl}/api/link/v1/${bondProvider}/accesstoken`;
                console.log(`Requesting Bond access token for '${url}' from '${bondAccessTokenUrl}'`);
                const accessTokenResponse = await apiAdapter.getJsonFrom(bondAccessTokenUrl, auth);
                return accessTokenResponse.token;
            } catch (error) {
                if (error.status === 404) {
                    console.log("User does not have a Bond account linked.");
                } else {
                    throw new RemoteServerError(error, 'Received error contacting Bond.');
                }
            }
        }
    };

    const fetch = async () => {
        let response;
        if (drsProvider.shouldRequestMetadata(requestedFields)) {
            try {
                hypotheticalErrorMessage = 'Could not fetch DRS metadata.';
                const httpsMetadataUrl = generateMetadataUrl(drsProvider, urlParts);
                console.log(
                    `Requesting DRS metadata for '${url}' from '${httpsMetadataUrl}' with auth required '${sendMetadataAuth}'`
                );
                response = await apiAdapter.getJsonFrom(httpsMetadataUrl, sendMetadataAuth ? auth : null);
            } catch (error) {
                throw new RemoteServerError(error, 'Received error while resolving DRS URL.');
            }
        }

        try {
            drsResponse = responseParser(response);
        } catch (error) {
            throw new RemoteServerError(error, 'Received error while parsing response from DRS URL.');
        }

        try {
            accessMethod = getAccessMethod(drsResponse, drsProvider);
        } catch (error) {
            throw new RemoteServerError(error, 'Received error while selecting access id.');
        }

        if (drsProvider.shouldFetchUserServiceAccount(accessMethod, requestedFields)) {
            try {
                hypotheticalErrorMessage = 'Could not fetch SA key from Bond.';
                const bondSAKeyUrl = `${config.bondBaseUrl}/api/link/v1/${bondProvider}/serviceaccount/key`;
                console.log(`Requesting Bond SA key for '${url}' from '${bondSAKeyUrl}'`);
                bondSA = await apiAdapter.getJsonFrom(bondSAKeyUrl, auth);
            } catch (error) {
                throw new RemoteServerError(error, 'Received error contacting Bond.');
            }
        }

        if (drsProvider.shouldFetchPassports(accessMethod, requestedFields)) {
            try {
                // For now, we are only getting a RAS passport. In the future it may also fetch from other providers.
                hypotheticalErrorMessage = 'Could not fetch passport from ECM.';
                const externalcredsGetPassportUrl = `${config.externalcredsBaseUrl}/api/oidc/v1/ras/passport`;
                console.log(`Requesting RAS passport for ${url} from externalcreds ${externalcredsGetPassportUrl}`);
                passports = [await apiAdapter.getJsonFrom(externalcredsGetPassportUrl, auth)];
            } catch (error) {
                if (error.status === 404) {
                    console.log("User does not have a passport.");
                } else {
                    throw new RemoteServerError(error,
                        'Received error contacting externalcreds.');
                }
            }
        }

        /*
         Try to retrieve the file name from the initial DRS response.

         NOTE: There is the possibility that whomever uploaded the DRS metadata did not populate the DRS name nor the DRS
         access URL stored in the DRS provider.

         In that case, the fileName will be returned as null.

         As a change request, for folks ingesting data without populating the name field, martha_v3 could ask the DRS
         provider for the expensive signed HTTPS URL, then retrieve the name of the file from the path in that URL.
         */
        fileName = getDrsFileName(drsResponse);

        // We've gotten far enough that we don't want to raise an error, even if we run out of time
        // while fetching a signed URL.
        hypotheticalErrorMessage = null;

        localizationPath = getLocalizationPath(drsProvider, drsResponse);

        try {
            const accessToken = await maybeFetchFenceAccessToken(accessMethod);

            // Retrieve the accessUrl using the returned accessToken, even if the token was empty.
            if (drsProvider.shouldFetchAccessUrl(accessMethod, requestedFields)) {
                try {
                    const httpsAccessUrl = generateAccessUrl(drsProvider, urlParts, accessMethod.access_id);
                    // Use the access token fetched in the call above or the auth submitted to Martha directly by the
                    // caller as appropriate.
                    const providerAccessMethod = drsProvider.accessMethodHavingSameTypeAs(accessMethod);
                    console.log(`Requesting DRS access URL for '${url}' from '${httpsAccessUrl}'`);

                    accessUrl = await getAccessUrl(providerAccessMethod.accessUrlAuth, httpsAccessUrl, accessToken, auth).then(async (accessUrlFirstTry) => {
                        if (!accessUrlFirstTry && providerAccessMethod.fallbackAccessUrlAuth) {
                            console.log(`Requesting DRS access URL for '${url}' from '${httpsAccessUrl}' with fallback auth`);
                            const fallbackAccessToken = await maybeFetchFenceAccessToken(accessMethod, true);
                            return getAccessUrl(providerAccessMethod.fallbackAccessUrlAuth, httpsAccessUrl, fallbackAccessToken, auth);
                        } else {
                            return accessUrlFirstTry;
                        }
                    });
                } catch (error) {
                    throw new RemoteServerError(error, 'Received error contacting DRS provider.');
                }
            }
        } catch (error) {
            if (drsProvider.shouldFailOnAccessUrlFail(accessMethod)) {
                throw error;
            }
            // Just log the error for now, there should be a cloud native way for the user to access the object.
            // Eventually once signed URLs are on by default for all providers we'll want to remove this outer try.
            console.warn('Ignoring error from fetching signed URL:', makeLogSafeRequestError(error));
        }
    };

    const timeout = Symbol.for('timeout');
    const waitUntilTimeIsAlmostUp = async () => {
        await delay(pencilsDownSeconds * 1000);
        return timeout;
    };

    // For now, since we can still return native object URLs, we don't want to fail if it takes too
    // long to fetch a signed URL. Eventually, we won't have native object URLs to fall back on so
    // we'll have to throw an error, at which point we can remove all of this `Promise.race` stuff.
    const winner = await Promise.race([
        fetch(),
        waitUntilTimeIsAlmostUp(),
    ]);

    if (winner === timeout && !hypotheticalErrorMessage) {
        console.log('Ran out of time fetching a signed URL; returning the native URL instead of throwing an error.');
    }

    if (hypotheticalErrorMessage) {
        throw new RemoteServerError(new Error(hypotheticalErrorMessage), 'Timed out resolving DRS URI.');
    }

    Object.assign(params, {
        bondProvider,
        drsResponse,
        fileName,
        localizationPath,
        accessUrl,
        bondSA,
    });
}

function buildResponseInfo(params) {
    const {
        requestedFields,
        bondProvider,
        drsResponse,
        fileName,
        localizationPath,
        accessUrl,
        bondSA,
    } = params;

    const fullResponse =
        requestedFields.length
            ? convertToMarthaV3Response(drsResponse, fileName, bondProvider, bondSA, accessUrl, localizationPath)
            : {};
    const partialResponse = mask(fullResponse, requestedFields.join(","));

    Object.assign(params, {
        partialResponse,
    });
}

/**
 * Handle the request as illustrated in:
 * https://lucid.app/lucidchart/428a0bdd-a884-4fc7-9a49-7bf300ef6777/edit
 *
 * At a high level:
 *   1. Determines the data provider from the DRS URI (based on hostname or compact identifier)
 *   2. Fetches the Google SA key from Bond [+]
 *   3. Fetches the DRS metadata from DRS server
 *   4. Fetches the Fence access token from Bond [+]
 *   5. Fetches a signed URL from DRS server [+]
 * ([+] only for some data providers and some objects)
 */
async function marthaV3Handler(req, res) {
    try {
        // This function counts on the request posting data as "application/json" content-type.
        // See: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests for more details
        const {url, fields: requestedFields = MARTHA_V3_DEFAULT_FIELDS} = (req && req.body) || {};
        const {authorization: auth, 'user-agent': userAgent} = req.headers;
        let {'martha-force-access-url': forceAccessUrl} = req.headers;
        const ip = req.ip;
        console.log(`Received URL '${url}' from agent '${userAgent}' on IP '${ip}'`);

        // Setting the value of the `martha-force-access-url` header to `false` should actually turn off forcing of
        // access URLs; don't let truthiness get in the way of that.
        if (typeof (forceAccessUrl) === 'string') {
            forceAccessUrl = forceAccessUrl.toLowerCase() === 'true';
        }
        forceAccessUrl = Boolean(forceAccessUrl);

        const params = {
            url,
            requestedFields,
            auth,
            forceAccessUrl,
        };

        buildRequestInfo(params);
        await retrieveFromServers(params);
        buildResponseInfo(params);

        res.status(200).send(params.partialResponse);
    } catch (error) {
        if (error instanceof BadRequestError) {
            logAndSendBadRequest(res, error);
        } else if (error instanceof RemoteServerError) {
            logAndSendServerError(res, error.cause, error.description);
        } else {
            console.error(`Uncaught error: ${error}`);
            throw error;
        }
    }
}

exports.marthaV3Handler = marthaV3Handler;
exports.generateMetadataUrl = generateMetadataUrl;
exports.generateAccessUrl = generateAccessUrl;
exports.getHttpsUrlParts = getHttpsUrlParts;
exports.overridePencilsDownSeconds = overridePencilsDownSeconds;
exports.PROTOCOL_PREFIX_DRS = PROTOCOL_PREFIX_DRS;
exports.secretManagerServiceClient = secretManagerServiceClient;
