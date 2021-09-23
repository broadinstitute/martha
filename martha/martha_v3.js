const {
    jadeDataRepoHostRegex,
    convertToMarthaV3Response,
    BadRequestError,
    RemoteServerError,
    logAndSendBadRequest,
    logAndSendServerError,
    delay,
} = require('../common/helpers');
const config = require('../common/config');
const apiAdapter = require('../common/api_adapter');
const url = require('url');
const mask = require('json-mask');

// All fields that can be returned in the martha_v3 response.
const MARTHA_V3_ALL_FIELDS = [
    'gsUri',
    'bucket',
    'name',
    'fileName',
    'contentType',
    'size',
    'hashes',
    'timeCreated',
    'timeUpdated',
    'googleServiceAccount',
    'bondProvider',
    'accessUrl',
];

const MARTHA_V3_DEFAULT_FIELDS = [
    'gsUri',
    'bucket',
    'name',
    'fileName',
    'contentType',
    'size',
    'hashes',
    'timeCreated',
    'timeUpdated',
    'googleServiceAccount',
];

// Response fields dependent on the DOS or DRS servers
const MARTHA_V3_METADATA_FIELDS = [
    'gsUri',
    'bucket',
    'name',
    'fileName',
    'contentType',
    'size',
    'hashes',
    'timeCreated',
    'timeUpdated',
    'accessUrl',
];

// Response fields dependent on the Bond service account
const MARTHA_V3_BOND_SA_FIELDS = [
    'googleServiceAccount',
];

// Response fields dependent on the the access_id
const MARTHA_V3_ACCESS_ID_FIELDS = [
    'accessUrl',
];

const BOND_PROVIDER_NONE = null; // Used for servers that should NOT contact bond
const BOND_PROVIDER_DCF_FENCE = 'dcf-fence'; // The default when we don't recognize the server
const BOND_PROVIDER_FENCE = 'fence';
const BOND_PROVIDER_ANVIL = 'anvil';
const BOND_PROVIDER_KIDS_FIRST = 'kids-first';

const ACCESS_METHOD_TYPES_NONE = [];
const ACCESS_METHOD_TYPE_GCS = 'gs';
const ACCESS_METHOD_TYPE_S3 = 's3';

const AUTH_REQUIRED = true;
const AUTH_SKIPPED = false;

const PROTOCOL_PREFIX_DRS='/ga4gh/drs/v1/objects';

// CIB URIs via https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit#
const DG_COMPACT_BDC_PROD = 'dg.4503';
const DG_COMPACT_BDC_STAGING = 'dg.712c';
const DG_COMPACT_THE_ANVIL = 'dg.anv0';
const DG_COMPACT_CRDC = 'dg.4dfc';
const DG_COMPACT_KIDS_FIRST = 'dg.f82a1a';

// Google Cloud Functions gives us 60 seconds to respond. We'll use most of it to fetch what we can,
// but not fail if we happen to time out when fetching a signed URL takes too long.
let pencilsDownSeconds = 58;

// For tests that need to probe the behavior near the limit of the Cloud Function timeout, we don't
// want to have to wait 60 seconds.
const overridePencilsDownSeconds = (seconds) => {
    pencilsDownSeconds = seconds;
};

// noinspection JSUnusedGlobalSymbols
class DrsType {
    constructor(urlParts, protocolPrefix, sendAuth, bondProvider, accessMethodTypes) {
        this.urlParts = urlParts;
        this.protocolPrefix = protocolPrefix;
        this.sendAuth = sendAuth;
        this.bondProvider = bondProvider;
        this.accessMethodTypes = accessMethodTypes;
    }
}

/**
 * Returns the first access method type listed in accessMethodTypes and the drsResponse, otherwise returns undefined.
 */
function getDrsAccessMethodType(drsResponse, accessMethodTypes) {
    if (!accessMethodTypes || !drsResponse || !drsResponse.access_methods) {
        return;
    }

    for (const accessMethodType of accessMethodTypes) {
        for (const accessMethod of drsResponse.access_methods) {
            if (accessMethod.type === accessMethodType) {
                return accessMethod.access_id;
            }
        }
    }
}

/**
 * Returns undefined if the matching access method does not have an access_id
 * or if the accessMethodType is falsy or if the drsResponse is falsy.
 */
function getDrsAccessId(drsResponse, accessMethodType) {
    if (!accessMethodType || !drsResponse || !drsResponse.access_methods) {
        return;
    }
    for (const accessMethod of drsResponse.access_methods) {
        if (accessMethod.type === accessMethodType) {
            return accessMethod.access_id;
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

/** *************************************************************************************************
 * URI parsers
 */

/**
 * Expands a CIB DRS URI host to a W3C/IETF URI hostname.
 */
function expandCibHost(cibHost) {
    switch (cibHost.toLowerCase()) {
        case DG_COMPACT_BDC_PROD: return config.bioDataCatalystHost;
        case DG_COMPACT_BDC_STAGING: return config.bioDataCatalystHost;
        case DG_COMPACT_THE_ANVIL: return config.theAnvilHost;
        case DG_COMPACT_CRDC: return config.crdcHost;
        case DG_COMPACT_KIDS_FIRST: return config.kidsFirstHost;
        default:
            throw new BadRequestError(`Unrecognized Compact Identifier Based host '${cibHost}.'`);
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
 * Returns the url parts of the DOS or DRS url, minus the protocol prefix as that is dependent on the host.
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

    If you update *any* of the below be sure to link to the supporting docs and update the comments above!
     */

    // The many different ways a DOS/DRS may be "compact", in the order that the should be tried
    const cibRegExps = [
        // Non-W3C CIB DOS/DRS URIs, where the `dg.abcd` appears more than once
        /(?:dos|drs):\/\/(?<host>dg\.[0-9a-z-]+)(?<separator>:)\k<host>\/(?<suffix>[^?]*)(?<query>\?(.*))?/i,
        // Non-W3C CIB DOS/DRS URIs, where the `dg.abcd` is only mentioned once
        /(?:dos|drs):\/\/(?<host>dg\.[0-9a-z-]+)(?<separator>:)(?<suffix>[^?]*)(?<query>\?(.*))?/i,
        // W3C compatible using a slash separator
        /(?:dos|drs):\/\/(?<host>dg\.[0-9a-z-]+)(?<separator>\/)(?<suffix>[^?]*)(?<query>\?(.*))?/i,
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
            // See `determineDrsType` for more info on this `martha_v2` backwards compatibility
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
function generateMetadataUrl(drsType) {
    const { urlParts, protocolPrefix } = drsType;
    // Construct a WHATWG URL by first only setting the protocol and the hostname: https://github.com/whatwg/url/issues/354
    const generatedUrl = new URL(`https://${urlParts.httpsUrlHost}`);
    generatedUrl.port = urlParts.httpsUrlPort;
    generatedUrl.pathname = `${protocolPrefix}/${urlParts.protocolSuffix}`;
    if (urlParts.httpsUrlSearch) {
        generatedUrl.search = urlParts.httpsUrlSearch;
    }
    return url.format(generatedUrl);
}

function generateAccessUrl(drsType, accessId) {
    const { urlParts, protocolPrefix } = drsType;
    // Construct a WHATWG URL by first only setting the protocol and the hostname: https://github.com/whatwg/url/issues/354
    const generatedUrl = new URL(`https://${urlParts.httpsUrlHost}`);
    generatedUrl.port = urlParts.httpsUrlPort;
    generatedUrl.pathname = `${protocolPrefix}/${urlParts.protocolSuffix}/access/${accessId}`;
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

/** *************************************************************************************************
 * Here is where all the logic lives that pairs a particular kind of URI with its
 * resolving-URL-generating parser, what path to use to make a Bond request for an SA (if any), and
 * a response parser.
 *
 * If you update this function update the README too!
 *
 * @param url {string} The URL to be tested
 * @return {DrsType}
 */
function determineDrsType(url) {
    const urlParts = getHttpsUrlParts(url);
    const host = urlParts.httpsUrlHost;

    // First handle servers that we know about...

    // BDC, but skip DOS/DRS URIs that might be a fake `martha_v2`-compatible BDC
    if ((host.endsWith(".biodatacatalyst.nhlbi.nih.gov") || (host === config.HOST_MOCK_DRS))
        && !urlParts.httpsUrlMaybeNotBdc) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_SKIPPED,
            BOND_PROVIDER_FENCE,
            /*
            BT-236 BDC signed URLs temporarily turned off

            As of Aug 2021 we only return signed urls for S3 hosted data. Eventually we will turn on signed urls for
            data hosted outside of S3. But today this line could equally work as:
             - `[ACCESS_METHOD_TYPE_GCS]`
             - `ACCESS_METHOD_TYPES_NONE`

            Since the code currently returns signed URLs only for S3 either option works and the former option was
            considered "more correct".
             */
            [ACCESS_METHOD_TYPE_GCS],
        );
    }

    // The AnVIL
    if (host.endsWith('.theanvil.io')) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_SKIPPED,
            BOND_PROVIDER_ANVIL,
            // For more info see comment above for BDC's `accessMethodType`
            [ACCESS_METHOD_TYPE_GCS],
        );
    }

    // Jade Data Repo
    if (jadeDataRepoHostRegex.test(host)) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_REQUIRED,
            BOND_PROVIDER_NONE,
            ACCESS_METHOD_TYPES_NONE,
        );
    }

    // CRDC
    if (host.endsWith('.datacommons.io')) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_SKIPPED,
            BOND_PROVIDER_DCF_FENCE,
            [ACCESS_METHOD_TYPE_GCS, ACCESS_METHOD_TYPE_S3],
        );
    }

    // Kids First
    if (host.endsWith('.kidsfirstdrc.org')) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_SKIPPED,
            BOND_PROVIDER_KIDS_FIRST,
            [ACCESS_METHOD_TYPE_S3],
        );
    }

    // RIP dataguids.org
    if (host.endsWith('dataguids.org')) {
        throw new BadRequestError('dataguids.org data has moved. See: https://support.terra.bio/hc/en-us/articles/360060681132');
    }

    // Fail explicitly for DRS ids for which Martha can not determine a provider.
    throw new BadRequestError(`Could not determine DRS provider for id '${url}'`);
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

/**
 * Used to check if any of the requested fields overlap with fields dependent on an underlying service.
 *
 * @param {string[]} requestedFields
 * @param {string[]} serviceFields
 * @returns {boolean} true if the requested fields overlap
 */
function overlapFields(requestedFields, serviceFields) {
    // via https://medium.com/@alvaro.saburido/set-theory-for-arrays-in-es6-eb2f20a61848
    return requestedFields.filter((field) => serviceFields.includes(field)).length !== 0;
}

function buildRequestInfo(params) {
    const {
        url,
        requestedFields,
        auth,
    } = params;

    validateRequest(url, auth, requestedFields);
    const drsType = determineDrsType(url);

    Object.assign(params, {
        drsType,
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
        drsType,
        url,
    } = params;

    const {sendAuth, bondProvider, accessMethodTypes} = drsType;
    console.log(
        `DRS URI '${url}' will use auth required '${sendAuth}', bond provider '${bondProvider}', ` +
        `and access method types '${accessMethodTypes.toString()}'`
    );
    console.log(`Requested fields are ${requestedFields.join(", ")}`);

    let bondSA;
    let drsResponse;
    let fileName;
    let accessUrl;

    // `fetch` below might time out in a way that we want to report as an error. Since the timeout
    // interrupts us while we're waiting for a response, we need to capture what we were about to
    // try doing just before we do it so that we can provide that detail in the error report.
    let hypotheticalErrorMessage;

    const fetch = async () => {
        let response;
        if (overlapFields(requestedFields, MARTHA_V3_METADATA_FIELDS)) {
            try {
                hypotheticalErrorMessage = 'Could not fetch DRS metadata.';
                const httpsMetadataUrl = generateMetadataUrl(drsType);
                console.log(
                    `Requesting DRS metadata for '${url}' from '${httpsMetadataUrl}' with auth required '${sendAuth}'`
                );
                response = await apiAdapter.getJsonFrom(httpsMetadataUrl, sendAuth ? auth : null);
            } catch (error) {
                throw new RemoteServerError(error, 'Received error while resolving DRS URL.');
            }
        }

        try {
            drsResponse = responseParser(response);
        } catch (error) {
            throw new RemoteServerError(error, 'Received error while parsing response from DRS URL.');
        }

        const accessMethodType = getDrsAccessMethodType(drsResponse, accessMethodTypes);

        /*
        As of BT-381, the same DRS server is hosting metadata for CRDC's GCS data and PDC's S3 data.

        So the hostname detection may discover GCS or S3 access_method.types. The royal "we" don't want to download GCS
        hosted files using signed URLs right now, as the `gsutil` downloader is working ok. Meanwhile, we don't have
        another option to download S3 hosted files other than signed URLs...

        When BT-161 is completed GCS will also used signed URLs, but that is likely to happen only after switching the
        Cromwell localizer to `getm`. When appropriate please remove this variable and this comment.
         */
        const accessMethodTypeIsS3 = accessMethodType === ACCESS_METHOD_TYPE_S3;
        // If the DrsType is definitely not GCS-based then asking Bond for `googleServiceAccount` does not make sense.
        // This is an extra layer of sanity check because the call above for DRS metadata will not happen if the caller
        // is not requesting metadata fields. Specifically, Rawls does not know that PDC is S3-based and will ask for
        // only the `googleServiceAccount` field leaving `accessMethodTypeIsS3` wrongly set to false.
        const drsTypeHasGcsAccessMethodType = accessMethodTypes.includes(ACCESS_METHOD_TYPE_GCS);

        if (bondProvider &&
            drsTypeHasGcsAccessMethodType &&
            !accessMethodTypeIsS3 &&
            overlapFields(requestedFields, MARTHA_V3_BOND_SA_FIELDS)) {
            try {
                hypotheticalErrorMessage = 'Could not fetch SA key from Bond.';
                const bondSAKeyUrl = `${config.bondBaseUrl}/api/link/v1/${bondProvider}/serviceaccount/key`;
                console.log(`Requesting Bond SA key for '${url}' from '${bondSAKeyUrl}'`);
                bondSA = await apiAdapter.getJsonFrom(bondSAKeyUrl, auth);
            } catch (error) {
                throw new RemoteServerError(error, 'Received error contacting Bond.');
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

        let accessId;

        try {
            if (accessMethodTypeIsS3 && overlapFields(requestedFields, MARTHA_V3_ACCESS_ID_FIELDS)) {
                try {
                    accessId = getDrsAccessId(drsResponse, accessMethodType);
                } catch (error) {
                    throw new RemoteServerError(error, 'Received error while parsing the access id.');
                }
            }

            // Retrieve an accessToken from Bond that will be used to later retrieve the accessUrl from the DRS server.
            let accessToken;
            if (bondProvider && accessId) {
                try {
                    const bondAccessTokenUrl = `${config.bondBaseUrl}/api/link/v1/${bondProvider}/accesstoken`;
                    console.log(`Requesting Bond access token for '${url}' from '${bondAccessTokenUrl}'`);
                    const accessTokenResponse = await apiAdapter.getJsonFrom(bondAccessTokenUrl, auth);
                    accessToken = accessTokenResponse.token;
                } catch (error) {
                    throw new RemoteServerError(error, 'Received error contacting Bond.');
                }
            }

            // Retrieve the accessUrl using the returned accessToken, even if the token was empty.
            if (bondProvider && accessId) {
                try {
                    const httpsAccessUrl = generateAccessUrl(drsType, accessId);
                    const accessTokenAuth = `Bearer ${accessToken}`;
                    console.log(`Requesting DRS access URL for '${url}' from '${httpsAccessUrl}'`);
                    accessUrl = await apiAdapter.getJsonFrom(httpsAccessUrl, accessTokenAuth);
                } catch (error) {
                    throw new RemoteServerError(error, 'Received error contacting DRS provider.');
                }
            }
        } catch (error) {
            if (accessMethodTypeIsS3) {
                // Throw if this is S3 and we failed to get a signed URL. Martha has no concept of a native S3
                // path so the caller will not have a fallback means of accessing the object.
                throw error;
            }
            // For non-S3 just log the error for now. There is still a native GCS path available that the caller
            // can use to access the object. Eventually, we'll want to remove this outer try.
            console.warn('Ignoring error from fetching signed URL:', error);
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
        accessUrl,
        bondSA,
    } = params;

    const fullResponse =
        requestedFields.length
            ? convertToMarthaV3Response(drsResponse, fileName, bondProvider, bondSA, accessUrl)
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
        const ip = req.ip;
        console.log(`Received URL '${url}' from agent '${userAgent}' on IP '${ip}'`);

        const params = {
            url,
            requestedFields,
            auth,
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
exports.DrsType = DrsType;
exports.determineDrsType = determineDrsType;
exports.generateMetadataUrl = generateMetadataUrl;
exports.generateAccessUrl = generateAccessUrl;
exports.getDrsAccessId = getDrsAccessId;
exports.getHttpsUrlParts = getHttpsUrlParts;
exports.MARTHA_V3_ALL_FIELDS = MARTHA_V3_ALL_FIELDS;
exports.overridePencilsDownSeconds = overridePencilsDownSeconds;
