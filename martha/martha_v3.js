const { parseRequest, convertToMarthaV3Response, FailureResponse } = require('../common/helpers');
const config = require('../config.json');
const apiAdapter = require('../common/api_adapter');
const url = require('url');

const BAD_REQUEST_ERROR_CODE = 400;
const SERVER_ERROR_CODE = 500;

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
    if (!response.data_object) { return response; }

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

    // Compact the AnVIL
    if (host === 'dg.anv0') {
        return new DrsType(
            DG_EXPANSION_THE_ANVIL,
            PROTOCOL_PREFIX_DOS,
            AUTH_SKIPPED,
            BOND_PROVIDER_ANVIL,
        );
    }

    // Full the AnVIL
    if (host === DG_EXPANSION_THE_ANVIL) {
        return new DrsType(
            DG_EXPANSION_NONE,
            PROTOCOL_PREFIX_DOS,
            AUTH_SKIPPED,
            BOND_PROVIDER_ANVIL,
        );
    }

    // Full Jade Data Repo
    if ((/jade.*\.datarepo-.*\.broadinstitute\.org/).test(host)) {
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

    // Assume BDC compact but with dcf-fence
    // If we don't recognize the dg.* assume like martha_v2 that everyone else
    // speaks DOS, doesn't require auth, and uses dcf-fence
    if (host.startsWith("dg.")) {
        return new DrsType(
            DG_EXPANSION_BIO_DATA_CATALYST,
            PROTOCOL_PREFIX_DOS,
            AUTH_SKIPPED,
            BOND_PROVIDER_DCF_FENCE,
        );
    }


    // If we don't recognize the server assume like martha_v2 that everyone else
    // speaks DOS, doesn't require auth, and uses dcf-fence
    return new DrsType(
        DG_EXPANSION_NONE,
        PROTOCOL_PREFIX_DOS,
        AUTH_SKIPPED,
        BOND_PROVIDER_DCF_FENCE,
    );
}

function validateRequest(dataObjectUri, auth) {
    if (!dataObjectUri) {
        throw new Error('URL of a DRS object is missing.');
    }

    if (!auth) {
        throw new Error('Authorization header is missing.');
    }
}

async function marthaV3Handler(req, res) {
    const dataObjectUri = parseRequest(req);
    const auth = req && req.headers && req.headers.authorization;
    console.log(`Received URL '${dataObjectUri}' from IP '${req.ip}'`);

    try {
        validateRequest(dataObjectUri, auth);
    } catch (error) {
        console.error(error);
        const failureResponse = new FailureResponse(BAD_REQUEST_ERROR_CODE, `Request is invalid. ${error.message}`);
        res.status(BAD_REQUEST_ERROR_CODE).send(failureResponse);
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(dataObjectUri);
    } catch (error) {
        console.error(error);
        const failureResponse = new FailureResponse(BAD_REQUEST_ERROR_CODE, error.message);
        res.status(BAD_REQUEST_ERROR_CODE).send(failureResponse);
        return;
    }

    if (!parsedUrl.hostname || (!parsedUrl.pathname && parsedUrl.hostname.toLowerCase().startsWith('dg.'))) {
        console.error(`"${url.format(parsedUrl)}" is missing a host and/or a path.`);
        const failureResponse = new FailureResponse(BAD_REQUEST_ERROR_CODE, `"${dataObjectUri}" is not a properly-formatted URI.`);
        res.status(BAD_REQUEST_ERROR_CODE).send(failureResponse);
        return;
    }

    const {dataGuidExpansion, protocolPrefix, sendAuth, bondProvider} = determineDrsType(parsedUrl);
    const drsUrl = httpsUrlGenerator(parsedUrl, dataGuidExpansion, protocolPrefix);
    const bondUrl = bondProvider && `${config.bondBaseUrl}/api/link/v1/${bondProvider}/serviceaccount/key`;
    console.log(`Converting DRS URI to HTTPS: ${dataObjectUri} -> ${drsUrl}`);

    let response;
    try {
        response = await apiAdapter.getJsonFrom(drsUrl, sendAuth ? auth : null);
    } catch (err) {
        console.log('Received error while resolving DRS URL.');
        console.error(err);

        const errorStatusCode = err.status;
        if (typeof errorStatusCode === 'undefined') {
            const failureResponse = new FailureResponse(SERVER_ERROR_CODE, `Received error while resolving DRS URL. ${err.message}`);
            res.status(SERVER_ERROR_CODE).send(failureResponse);
        } else {
            res.status(errorStatusCode).send(err);
        }
        return;
    }

    let drsResponse;
    try {
        drsResponse = responseParser(response);
    } catch (err) {
        console.log('Received error while parsing response from DRS URL.');
        console.error(err);

        const errorStatusCode = err.status;
        if (typeof errorStatusCode === 'undefined') {
            const failureResponse = new FailureResponse(SERVER_ERROR_CODE, `Received error while parsing response from DRS URL. ${err.message}`);
            res.status(SERVER_ERROR_CODE).send(failureResponse);
        } else {
            res.status(errorStatusCode).send(err);
        }
        return;
    }

    let bondSA;
    if (bondUrl) {
        try {
            bondSA = await apiAdapter.getJsonFrom(bondUrl, auth);
        } catch (err) {
            console.log('Received error contacting Bond.');
            console.error(err);

            const errorStatusCode = err.status;
            if (typeof errorStatusCode === 'undefined') {
                const failureResponse = new FailureResponse(SERVER_ERROR_CODE, `Received error while getting SA from Bond. ${err.message}`);
                res.status(SERVER_ERROR_CODE).send(failureResponse);
            } else {
                res.status(errorStatusCode).send(err);
            }
            return;
        }
    }

    res.status(200).send(convertToMarthaV3Response(drsResponse, bondSA));
}

exports.marthaV3Handler = marthaV3Handler;
exports.determineDrsType = determineDrsType;
exports.httpsUrlGenerator = httpsUrlGenerator;
