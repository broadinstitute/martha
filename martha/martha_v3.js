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
    "gsUri",
    "bucket",
    "name",
    "fileName",
    "contentType",
    "size",
    "hashes",
    "timeCreated",
    "timeUpdated",
    "googleServiceAccount",
];

// Response fields dependent on the DOS or DRS servers
const DRS_FIELDS = [
    "gsUri",
    "bucket",
    "name",
    "fileName",
    "contentType",
    "size",
    "hashes",
    "timeCreated",
    "timeUpdated",
];

// Response fields dependent on Bond
const BOND_FIELDS = [
    "googleServiceAccount",
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
const DG_EXPANSION_NONE = null;
const DG_EXPANSION_BIO_DATA_CATALYST = config.dataObjectResolutionHost;
const DG_EXPANSION_THE_ANVIL = 'gen3.theanvil.io';

// noinspection JSUnusedGlobalSymbols
class DrsType {
    constructor(dataGuidExpansion, protocolPrefix, sendAuth, bondProvider) {
        this.dataGuidExpansion = dataGuidExpansion;
        this.protocolPrefix = protocolPrefix;
        this.sendAuth = sendAuth;
        this.bondProvider = bondProvider;
    }
}

/** *************************************************************************************************
 * URI parsers
 */

function fullUrlGenerator (parsedUrl, protocolPrefix) {
    return url.format({
        protocol: 'https',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: `${protocolPrefix}${parsedUrl.pathname || `/${parsedUrl.hostname}`}`,
        search: parsedUrl.search
    });
}

const compactUrlGenerator = (dataGuidExpansion) => function (parsedUrl, protocolPrefix) {
    return url.format({
        protocol: 'https',
        hostname: dataGuidExpansion,
        port: parsedUrl.port,
        pathname: `${protocolPrefix}/${parsedUrl.hostname}${parsedUrl.pathname || ''}`,
        search: parsedUrl.search
    });
};

// NOTE: reimplementation of dataObjectUriToHttps in helper.js
function httpsUrlGenerator (parsedUrl, dataGuidExpansion, protocolPrefix) {
    const generator = dataGuidExpansion ? compactUrlGenerator(dataGuidExpansion) : fullUrlGenerator;
    return generator(parsedUrl, protocolPrefix);
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

function determineDrsType (parsedUrl) {
    const host = parsedUrl.hostname.toLowerCase();

    // First handle servers that we know about...

    // Compact BDC
    if (['dg.4503', 'dg.712c'].includes(host)) {
        return new DrsType(
            DG_EXPANSION_BIO_DATA_CATALYST,
            PROTOCOL_PREFIX_DOS,
            AUTH_SKIPPED,
            BOND_PROVIDER_FENCE,
        );
    }

    // Full BDC
    if (host === DG_EXPANSION_BIO_DATA_CATALYST) {
        return new DrsType(
            DG_EXPANSION_NONE,
            PROTOCOL_PREFIX_DOS,
            AUTH_SKIPPED,
            BOND_PROVIDER_FENCE,
        );
    }

    // Compact The AnVIL
    if (host === 'dg.anv0') {
        return new DrsType(
            DG_EXPANSION_THE_ANVIL,
            PROTOCOL_PREFIX_DOS,
            AUTH_SKIPPED,
            BOND_PROVIDER_ANVIL,
        );
    }

    // Full The AnVIL
    if (host === DG_EXPANSION_THE_ANVIL) {
        return new DrsType(
            DG_EXPANSION_NONE,
            PROTOCOL_PREFIX_DOS,
            AUTH_SKIPPED,
            BOND_PROVIDER_ANVIL,
        );
    }

    // Full Jade Data Repo
    if (jadeDataRepoHostRegex.test(host)) {
        return new DrsType(
            DG_EXPANSION_NONE,
            PROTOCOL_PREFIX_DRS,
            AUTH_REQUIRED,
            BOND_PROVIDER_NONE,
        );
    }

    // Full HCA
    if (host.endsWith('.humancellatlas.org')) {
        return new DrsType(
            DG_EXPANSION_NONE,
            PROTOCOL_PREFIX_DOS,
            AUTH_SKIPPED,
            BOND_PROVIDER_NONE,
        );
    }

    // Full CRDC
    if (host.endsWith('.datacommons.io')) {
        return new DrsType(
            DG_EXPANSION_NONE,
            PROTOCOL_PREFIX_DRS,
            AUTH_REQUIRED,
            BOND_PROVIDER_NONE,
        );
    }

    // Assume this is a BDC compact URI but using dcf-fence Bond provider.
    // If we don't recognize the dg.* assume like martha_v2 that everyone else
    // speaks DOS, doesn't require auth, and uses dcf-fence.
    if (host.startsWith("dg.")) {
        return new DrsType(
            DG_EXPANSION_BIO_DATA_CATALYST,
            PROTOCOL_PREFIX_DOS,
            AUTH_SKIPPED,
            BOND_PROVIDER_DCF_FENCE,
        );
    }


    // If we don't recognize the server assume like martha_v2 that everyone else
    // speaks DOS, doesn't require auth, and uses dcf-fence.
    return new DrsType(
        DG_EXPANSION_NONE,
        PROTOCOL_PREFIX_DOS,
        AUTH_SKIPPED,
        BOND_PROVIDER_DCF_FENCE,
    );
}

function validateRequest(dataObjectUri, auth, requestedFields) {
    if (!dataObjectUri) {
        throw new Error('URL of a DRS object is missing.');
    }

    if (!auth) {
        throw new Error('Authorization header is missing.');
    }

    if (!Array.isArray(requestedFields)) {
        throw new Error(`Fields was not an array.`);
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
    const { url: dataObjectUri, fields: requestedFields = ALL_FIELDS } = parseRequest(req);
    const auth = req && req.headers && req.headers.authorization;
    console.log(`Received URL '${dataObjectUri}' from IP '${req.ip}'`);

    try {
        validateRequest(dataObjectUri, auth, requestedFields);
    } catch (error) {
        logAndSendBadRequest(res, error);
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(dataObjectUri);
    } catch (error) {
        logAndSendBadRequest(res, error);
        return;
    }

    if (!parsedUrl.hostname || (!parsedUrl.pathname && parsedUrl.hostname.toLowerCase().startsWith('dg.'))) {
        logAndSendBadRequest(res, new Error(`"${url.format(parsedUrl)}" is missing a host and/or a path.`));
        return;
    }

    const {dataGuidExpansion, protocolPrefix, sendAuth, bondProvider} = determineDrsType(parsedUrl);
    const drsUrl = httpsUrlGenerator(parsedUrl, dataGuidExpansion, protocolPrefix);
    const bondUrl = bondProvider && `${config.bondBaseUrl}/api/link/v1/${bondProvider}/serviceaccount/key`;
    console.log(`Converted DRS URI to HTTPS: ${dataObjectUri} -> ${drsUrl}`);

    let response;
    if (overlapFields(requestedFields, DRS_FIELDS)) {
        try {
            response = await apiAdapter.getJsonFrom(drsUrl, sendAuth ? auth : null);
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

    const fullResponse = requestedFields.length ? convertToMarthaV3Response(drsResponse, bondSA) : {};
    const partialResponse = mask(fullResponse, requestedFields.join(","));

    res.status(200).send(partialResponse);
}

exports.marthaV3Handler = marthaV3Handler;
exports.determineDrsType = determineDrsType;
exports.httpsUrlGenerator = httpsUrlGenerator;
