const {
    jadeDataRepoHostRegex,
    convertToMarthaV3Response,
    BadRequestError,
    RemoteServerError,
    logAndSendBadRequest,
    logAndSendServerError,
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

const ACCESS_METHOD_TYPE_NONE = null;
const ACCESS_METHOD_TYPE_GCS = 'gs';
const ACCESS_METHOD_TYPE_S3 = 's3';

const AUTH_REQUIRED = true;
const AUTH_SKIPPED = false;

const PROTOCOL_PREFIX_DOS='/ga4gh/dos/v1/dataobjects';
const PROTOCOL_PREFIX_DRS='/ga4gh/drs/v1/objects';

// CIB URIs via https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit#
const DG_COMPACT_BDC_PROD = 'dg.4503';
const DG_COMPACT_BDC_STAGING = 'dg.712c';
const DG_COMPACT_THE_ANVIL = 'dg.anv0';
const DG_COMPACT_CRDC = 'dg.4dfc';
const DG_COMPACT_KIDS_FIRST = 'dg.f82a1a';

class DrsType {
    constructor(urlParts, protocolPrefix, sendAuth, bondProvider, accessMethodType) {
        this.urlParts = urlParts;
        this.protocolPrefix = protocolPrefix;
        this.sendAuth = sendAuth;
        this.bondProvider = bondProvider;
        this.accessMethodType = accessMethodType;
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
        // Someday we'll throw an error. For now replicate the behavior of `martha_v2`.
        default: return config.bioDataCatalystHost;
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
        case DG_COMPACT_BDC_PROD: return `${cibHost}/${cibSuffix}`;
        case DG_COMPACT_BDC_STAGING: return `${cibHost}/${cibSuffix}`;
        case DG_COMPACT_THE_ANVIL: return `${cibHost}/${cibSuffix}`;
        // Following the spec and only returning the suffix
        case DG_COMPACT_CRDC: return cibSuffix;
        case DG_COMPACT_KIDS_FIRST: return cibSuffix;
        // Someday we'll throw an error. For now replicate the behavior of `martha_v2` and assume this URL goes to BDC.
        default: return `${cibHost}/${cibSuffix}`;
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
function generateMetadataUrl(urlParts, protocolPrefix) {
    // Construct a WHATWG URL by first only setting the protocol and the hostname: https://github.com/whatwg/url/issues/354
    const generatedUrl = new URL(`https://${urlParts.httpsUrlHost}`);
    generatedUrl.port = urlParts.httpsUrlPort;
    generatedUrl.pathname = `${protocolPrefix}/${urlParts.protocolSuffix}`;
    if (urlParts.httpsUrlSearch) {
        generatedUrl.search = urlParts.httpsUrlSearch;
    }
    return url.format(generatedUrl);
}

function generateAccessUrl(urlParts, protocolPrefix, accessId) {
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
            ACCESS_METHOD_TYPE_NONE, /* BT-236 BDC signed URLs temporarily turned off */
        );
    }

    // The AnVIL
    if (host.endsWith('.theanvil.io')) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_SKIPPED,
            BOND_PROVIDER_ANVIL,
            ACCESS_METHOD_TYPE_NONE,
        );
    }

    // Jade Data Repo
    if (jadeDataRepoHostRegex.test(host)) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_REQUIRED,
            BOND_PROVIDER_NONE,
            ACCESS_METHOD_TYPE_NONE,
        );
    }

    // CRDC
    if (host.endsWith('.datacommons.io')) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_SKIPPED,
            BOND_PROVIDER_DCF_FENCE,
            ACCESS_METHOD_TYPE_NONE,
        );
    }

    if (host.endsWith('.kidsfirstdrc.org')) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_SKIPPED,
            BOND_PROVIDER_KIDS_FIRST,
            ACCESS_METHOD_TYPE_S3,
        );
    }

    // If we don't recognize the server assume like martha_v2 that everyone else
    // speaks DOS, doesn't require auth, and uses dcf-fence.
    return new DrsType(
        urlParts,
        PROTOCOL_PREFIX_DOS,
        AUTH_SKIPPED,
        BOND_PROVIDER_DCF_FENCE,
        ACCESS_METHOD_TYPE_NONE,
    );
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

    if (!requestedFields.length) {
        throw new BadRequestError(`The 'fields' array was empty.`);
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

/**
 * Determines various request variables based on the requested URL.
 */
function buildDrsRequestInfo(params) {
    const {
        url,
    } = params;

    const { urlParts, protocolPrefix, sendAuth, bondProvider, accessMethodType } = determineDrsType(url);

    console.log(
        `DRS URI '${url}' will use authorization required '${sendAuth}', bond provider '${bondProvider}', ` +
        `and access method type '${accessMethodType}'`
    );

    Object.assign(params, {
        urlParts,
        protocolPrefix,
        sendAuth,
        bondProvider,
        accessMethodType,
    });
}

/**
 * Maybe retrieves the initial metadata drsResponse from the DRS provider.
 */
async function retrieveDrsMetadata(params) {
    const {
        url,
        requestedFields,
        auth,
        urlParts,
        protocolPrefix,
        sendAuth,
        accessMethodType,
    } = params;

    let metadataResponse;
    if (overlapFields(requestedFields, MARTHA_V3_METADATA_FIELDS)) {
        try {
            const httpsMetadataUrl = generateMetadataUrl(urlParts, protocolPrefix);
            console.log(
                `Requesting DRS metadata for '${url}' from '${httpsMetadataUrl}' ` +
                `with authorization required '${sendAuth}'`
            );
            metadataResponse = await apiAdapter.getJsonFrom(httpsMetadataUrl, sendAuth ? auth : null);
        } catch (error) {
            throw new RemoteServerError(error, 'Received error while resolving DRS URL.');
        }
    }

    let drsResponse;
    try {
        drsResponse = responseParser(metadataResponse);
    } catch (error) {
        throw new RemoteServerError(error, 'Received error while parsing response from DRS URL.');
    }

    /*
    Try to retrieve the file name from the initial DRS response.

    NOTE: There is the possibility that whomever uploaded the DRS metadata did not populate the DRS name nor the DRS
    access URL stored in the DRS provider.

    In that case, the fileName will be returned as null.

    As a change request, for folks ingesting data without populating the name field, martha_v3 could ask the DRS
    provider for the expensive signed HTTPS URL, then retrieve the name of the file from the path in that URL.
     */
    const fileName = getDrsFileName(drsResponse);

    let accessId;
    if (overlapFields(requestedFields, MARTHA_V3_ACCESS_ID_FIELDS)) {
        try {
            accessId = getDrsAccessId(drsResponse, accessMethodType);
        } catch (error) {
            throw new RemoteServerError(error, 'Received error while parsing the access id.');
        }
    }

    Object.assign(params, {
        drsResponse,
        fileName,
        accessId,
    });
}

/**
 * Maybe retrieves an accessToken from Bond that may be further used to retrieve an accessUrl using an accessId.
 */
async function retrieveBondAccessToken(params) {
    const {
        url,
        auth,
        bondProvider,
        accessId,
    } = params;

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

    Object.assign(params, {
        accessToken,
    });
}

/**
 * Maybe retrieves the accessUrl from the DRS provider using the accessToken, possibly adding requester pays.
 */
async function retrieveDrsAccessUrl(params) {
    const {
        url,
        googleBillingProject,
        urlParts,
        protocolPrefix,
        bondProvider,
        accessId,
        accessToken,
    } = params;

    // Retrieve the accessUrl using the returned accessToken, even if the token was empty.
    let accessUrl;
    if (bondProvider && accessId) {
        try {
            const httpsAccessUrl = generateAccessUrl(urlParts, protocolPrefix, accessId);
            const accessUrlAuth = `Bearer ${accessToken}`;
            console.log(`Requesting DRS access URL for '${url}' from '${httpsAccessUrl}'`);
            accessUrl = await apiAdapter.getJsonFrom(httpsAccessUrl, accessUrlAuth);
        } catch (error) {
            throw new RemoteServerError(error, 'Received error contacting DRS provider.');
        }
    }

    // Check if requester pays billing should be added to the URL.
    let needsRequesterPays;
    if (accessUrl && googleBillingProject) {
        try {
            needsRequesterPays = await apiAdapter.isGcsRequesterPaysUrl(accessUrl.url);
        } catch (error) {
            throw new RemoteServerError(error, 'Received error checking for requester pays.');
        }
    }

    if (needsRequesterPays) {
        // For now assume this is a GCS V2 signed URL that can be modified
        accessUrl.url = `${accessUrl.url}&userProject=${googleBillingProject}`;
    }

    Object.assign(params, {
        accessUrl,
    });
}

/**
 * Maybe retrieve a google service account from Bond that may be used to access the underlying DRS file data.
 */
async function retrieveBondServiceAccount(params) {
    const {
        url,
        requestedFields,
        auth,
        bondProvider,
        accessMethodType,
    } = params;

    let googleServiceAccount;
    // Only retrieve the SA for projects that implicitly or explicitly use GCS for accessing the data.
    const accessMethodTypesRequiringSA = [ACCESS_METHOD_TYPE_NONE, ACCESS_METHOD_TYPE_GCS];
    if (bondProvider &&
        accessMethodTypesRequiringSA.includes(accessMethodType) &&
        overlapFields(requestedFields, MARTHA_V3_BOND_SA_FIELDS)) {
        try {
            const bondServiceAccountKeyUrl = `${config.bondBaseUrl}/api/link/v1/${bondProvider}/serviceaccount/key`;
            console.log(`Requesting Bond SA key for '${url}' from '${bondServiceAccountKeyUrl}'`);
            googleServiceAccount = await apiAdapter.getJsonFrom(bondServiceAccountKeyUrl, auth);
        } catch (error) {
            throw new RemoteServerError(error, 'Received error contacting Bond.');
        }
    }

    Object.assign(params, {
        googleServiceAccount,
    });
}

/**
 * Collect the retrieved values into a response to send back to the martha_v3 client.
 */
function buildDrsResponseInfo(params) {
    const {
        bondProvider,
        drsResponse,
        fileName,
        accessUrl,
        googleServiceAccount,
    } = params;

    const fullResponse =
        convertToMarthaV3Response(drsResponse, fileName, bondProvider, googleServiceAccount, accessUrl);

    Object.assign(params, {
        fullResponse,
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
async function marthaV3Handler(req, res) {
    try {
        // This function counts on the request posting data as "application/json" content-type.
        // See: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests for more details
        const {
            url,
            googleBillingProject,
            fields: requestedFields = MARTHA_V3_DEFAULT_FIELDS,
        } = req.body || {};
        const {
            authorization: auth,
            'user-agent': userAgent,
        } = req.headers;
        const ip = req.ip;
        console.log(`Received URL '${url}' from agent '${userAgent}' on IP '${ip}'`);

        validateRequest(url, auth, requestedFields);

        const protocol = url.split('://')[0];
        const params = {
            url,
            googleBillingProject,
            requestedFields,
            auth,
        };

        switch (protocol) {
            case 'dos':
            case 'drs': {
                buildDrsRequestInfo(params);
                await retrieveDrsMetadata(params);
                await retrieveBondAccessToken(params);
                await retrieveDrsAccessUrl(params);
                await retrieveBondServiceAccount(params);
                buildDrsResponseInfo(params);
                break;
            }
            /*
            Possible future for Terra/FC-UI:
            Retrieve 'gs' metadata, and maybe process requests for a 'signedUrl' field?
            Then maybe there would be no need for maintaining the separate fileSummaryV1 nor getSignedUrlV1.
            See: https://broadworkbench.atlassian.net/wiki/spaces/WA/pages/880050177/Martha+Endpoints+and+Clients
             */
            default: {
                const error = new BadRequestError("'url' must start with 'dos://' or 'drs://'");
                logAndSendBadRequest(res, error);
                return;
            }
        }

        console.log(`Returning '${url}' fields ['${requestedFields.join("', '")}']`);
        const partialResponse = mask(params.fullResponse, requestedFields.join(","));
        res.status(200).send(partialResponse);
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

module.exports = {
    MARTHA_V3_ALL_FIELDS,
    getDrsAccessId,
    getHttpsUrlParts,
    generateMetadataUrl,
    generateAccessUrl,
    determineDrsType,
    marthaV3Handler,
};
