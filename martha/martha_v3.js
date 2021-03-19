const {
    jadeDataRepoHostRegex,
    parseRequest,
    convertToMarthaV3Response,
    logAndSendBadRequest,
    logAndSendServerError,
} = require('../common/helpers');
const config = require('../common/config');
const apiAdapter = require('../common/api_adapter');
const url = require('url');
const mask = require('json-mask');

// All fields that can be returned in the martha_v3 response
const ALL_FIELDS = [
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
];

const DEFAULT_FIELDS = [
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
const DRS_FIELDS = [
    'gsUri',
    'bucket',
    'name',
    'fileName',
    'contentType',
    'size',
    'hashes',
    'timeCreated',
    'timeUpdated',
];

// Response fields dependent on Bond
const BOND_FIELDS = [
    'googleServiceAccount',
];

const BOND_PROVIDER_NONE = null; // Used for servers that should NOT contact bond
const BOND_PROVIDER_DCF_FENCE = 'dcf-fence'; // The default when we don't recognize the server
const BOND_PROVIDER_FENCE = 'fence';
const BOND_PROVIDER_ANVIL = 'anvil';

const AUTH_REQUIRED = true;
const AUTH_SKIPPED = false;

const PROTOCOL_PREFIX_DOS='/ga4gh/dos/v1/dataobjects';
const PROTOCOL_PREFIX_DRS='/ga4gh/drs/v1/objects';

// TODO: Does dataguids.org actually have a resolution API??
// Until we figure that out, we'll try to re-implement the mappings we know about here.
const {
    bioDataCatalystHost: DG_EXPANSION_BDC,
    theAnvilHost: DG_EXPANSION_THE_ANVIL,
    crdcHost: DG_EXPANSION_CRDC,
    kidsFirstHost: DG_EXPANSION_KIDS_FIRST
} = config;

// CIB URIs via https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit#
const DG_COMPACT_BDC_PROD = 'dg.4503';
const DG_COMPACT_BDC_STAGING = 'dg.712c';
const DG_COMPACT_THE_ANVIL = 'dg.anv0';
const DG_COMPACT_CRDC = 'dg.4dfc';
const DG_COMPACT_KIDS_FIRST = 'dg.f82a1a';

// noinspection JSUnusedGlobalSymbols
class DrsType {
    constructor(urlParts, protocolPrefix, sendAuth, bondProvider) {
        this.urlParts = urlParts;
        this.protocolPrefix = protocolPrefix;
        this.sendAuth = sendAuth;
        this.bondProvider = bondProvider;
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
        case DG_COMPACT_BDC_PROD: return DG_EXPANSION_BDC;
        case DG_COMPACT_BDC_STAGING: return DG_EXPANSION_BDC;
        case DG_COMPACT_THE_ANVIL: return DG_EXPANSION_THE_ANVIL;
        case DG_COMPACT_CRDC: return DG_EXPANSION_CRDC;
        case DG_COMPACT_KIDS_FIRST: return DG_EXPANSION_KIDS_FIRST;
        // Someday we'll throw an error. For now replicate the behavior of `martha_v2`.
        default: return DG_EXPANSION_BDC;
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
        /(?:dos|drs):\/\/(?<host>dg\.[0-9a-z-]+)(?<separator>:)(?:\k<host>)\/(?<suffix>[^?]*)(?<query>\?(.*))?/i,
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

    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname || !parsedUrl.pathname) {
        throw new Error(`"${url}" is missing a host and/or a path.`);
    }
    return {
        httpsUrlHost: parsedUrl.hostname,
        httpsUrlPort: parsedUrl.port,
        protocolSuffix: parsedUrl.pathname.slice(1),
        httpsUrlSearch: parsedUrl.search,
    };
}

// NOTE: reimplementation of dataObjectUriToHttps in helper.js
function httpsUrlGenerator(drsType) {
    const { urlParts, protocolPrefix } = drsType;
    return url.format({
        protocol: 'https',
        hostname: urlParts.httpsUrlHost,
        pathname: `${protocolPrefix}/${urlParts.protocolSuffix}`,
        port: urlParts.httpsUrlPort,
        search: urlParts.httpsUrlSearch
    });
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
 */

function determineDrsType(url) {
    const urlParts = getHttpsUrlParts(url);
    const host = urlParts.httpsUrlHost;

    // First handle servers that we know about...

    // BDC, but skip DOS/DRS URIs that might be a fake `martha_v2`-compatible BDC
    const bioDataCatalystHosts = [
        config.HOST_BIODATA_CATALYST_PROD, config.HOST_BIODATA_CATALYST_STAGING, config.HOST_MOCK_DRS]
    if (bioDataCatalystHosts.includes(host) && !urlParts.httpsUrlMaybeNotBdc) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_SKIPPED,
            BOND_PROVIDER_FENCE,
        );
    }

    // The AnVIL
    if ((host === config.HOST_THE_ANVIL_PROD || host === config.HOST_THE_ANVIL_STAGING)) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_SKIPPED,
            BOND_PROVIDER_ANVIL,
        );
    }

    // Jade Data Repo
    if (jadeDataRepoHostRegex.test(host)) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_REQUIRED,
            BOND_PROVIDER_NONE,
        );
    }

    // HCA
    if (host.endsWith('.humancellatlas.org')) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DOS,
            AUTH_SKIPPED,
            BOND_PROVIDER_NONE,
        );
    }

    // CRDC
    if (host.endsWith('.datacommons.io')) {
        return new DrsType(
            urlParts,
            PROTOCOL_PREFIX_DRS,
            AUTH_SKIPPED,
            BOND_PROVIDER_DCF_FENCE,
        );
    }

    // If we don't recognize the server assume like martha_v2 that everyone else
    // speaks DOS, doesn't require auth, and uses dcf-fence.
    return new DrsType(
        urlParts,
        PROTOCOL_PREFIX_DOS,
        AUTH_SKIPPED,
        BOND_PROVIDER_DCF_FENCE,
    );
}

function validateRequest(url, auth, requestedFields) {
    if (!url) {
        throw new Error(`'url' is missing.`);
    }

    if (!auth) {
        throw new Error('Authorization header is missing.');
    }

    if (!Array.isArray(requestedFields)) {
        throw new Error(`'fields' was not an array.`);
    }

    const invalidFields = requestedFields.filter((field) => !ALL_FIELDS.includes(field));
    if (invalidFields.length !== 0) {
        throw new Error(
            `Fields '${invalidFields.join("','")}' are not supported. ` +
            `Supported fields are '${ALL_FIELDS.join("', '")}'.`
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

async function marthaV3Handler(req, res) {
    const {url, fields: requestedFields = DEFAULT_FIELDS} = parseRequest(req);
    const {authorization: auth, 'user-agent': userAgent} = req.headers;
    console.log(`Received URL '${url}' from agent '${userAgent}' on IP '${req.ip}'`);

    try {
        validateRequest(url, auth, requestedFields);
    } catch (error) {
        logAndSendBadRequest(res, error);
        return;
    }

    let drsType;
    try {
        drsType = determineDrsType(url);
    } catch (error) {
        logAndSendBadRequest(res, error);
        return;
    }

    const httpsMetadataUrl = httpsUrlGenerator(drsType);
    const {sendAuth, bondProvider} = drsType;
    const bondUrl = bondProvider && `${config.bondBaseUrl}/api/link/v1/${bondProvider}/serviceaccount/key`;
    console.log(
        `Converted DRS URI to HTTPS: ${url} -> ${httpsMetadataUrl} ` +
        `with auth required '${sendAuth}' and bond provider '${bondProvider}'`
    );

    let response;
    if (overlapFields(requestedFields, DRS_FIELDS)) {
        try {
            response = await apiAdapter.getJsonFrom(httpsMetadataUrl, sendAuth ? auth : null);
        } catch (error) {
            logAndSendServerError(res, error, 'Received error while resolving DRS URL.');
            return;
        }
    }

    let drsResponse;
    try {
        drsResponse = responseParser(response);
    } catch (error) {
        logAndSendServerError(res, error, 'Received error while parsing response from DRS URL.');
        return;
    }

    let bondSA;
    if (bondUrl && overlapFields(requestedFields, BOND_FIELDS)) {
        try {
            bondSA = await apiAdapter.getJsonFrom(bondUrl, auth);
        } catch (error) {
            logAndSendServerError(res, error, 'Received error contacting Bond.');
            return;
        }
    }

    const fullResponse = requestedFields.length ? convertToMarthaV3Response(drsResponse, bondProvider, bondSA) : {};
    const partialResponse = mask(fullResponse, requestedFields.join(","));

    res.status(200).send(partialResponse);
}

exports.marthaV3Handler = marthaV3Handler;
exports.determineDrsType = determineDrsType;
exports.httpsUrlGenerator = httpsUrlGenerator;
exports.allMarthaFields = ALL_FIELDS;
