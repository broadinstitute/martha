const { parseRequest, convertToMarthaV3Response, FailureResponse } = require('../common/helpers');
const config = require('../config.json');
const apiAdapter = require('../common/api_adapter');
const url = require('url');

const BAD_REQUEST_ERROR_CODE = 400;
const SERVER_ERROR_CODE = 500;

const BOND_LINK_NONE = null; // Used for servers that should NOT contact bond
const BOND_LINK_DCF_FENCE = 'dcf-fence'; // The default when we don't recognize the server
const BOND_LINK_FENCE = 'fence';
const BOND_LINK_ANVIL = 'anvil';

const AUTH_REQUIRED = true;
const AUTH_SKIPPED = false;

const PROTOCOL_PREFIX_DOS='/ga4gh/dos/v1/dataobjects';
const PROTOCOL_PREFIX_DRS='/ga4gh/drs/v1/objects';

class DrsType {
    constructor(urlGenerator, sendAuth, bondLink) {
        this.urlGenerator = urlGenerator;
        this.sendAuth = sendAuth;
        this.bondLink = bondLink;
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

function compactUrlGenerator (parsedUrl, protocolPrefix) {
    return url.format({
        protocol: 'https',
        hostname: config.dataObjectResolutionHost,
        port: parsedUrl.port,
        pathname: `${protocolPrefix}/${parsedUrl.hostname}${parsedUrl.pathname || ''}`,
        search: parsedUrl.search
    });
}

function drsFullUrlGenerator (parsedUrl) {
    return fullUrlGenerator(parsedUrl, PROTOCOL_PREFIX_DRS);
}

function dosFullUrlGenerator (parsedUrl) {
    return fullUrlGenerator(parsedUrl, PROTOCOL_PREFIX_DOS);
}

function dosCompactUrlGenerator (parsedUrl) {
    return compactUrlGenerator(parsedUrl, PROTOCOL_PREFIX_DOS);
}

/** *************************************************************************************************
 * Response parsers
 */

function responseParser (response) {
    // If this is not a DOS response, assume it's already DRS and return it.
    if (!response.data_object) { return response; }

    // Otherwise, find the DOS fields and convert them to DRS.
    const accessMethods =
        response.data_object.urls &&
        response.data_object.urls
            .filter((e) => e.url.startsWith('gs://'))
            .map((gsUrl) => { return { type: 'gs', access_url: { url: gsUrl.url } }; });
    return {
        access_methods: accessMethods,
        checksums: response.data_object.checksums,
        created_time: response.data_object.created,
        mime_type: response.data_object.mimeType,
        name: response.data_object.name,
        size: response.data_object.size,
        updated_time: response.data_object.updated,
    };
}

/** *************************************************************************************************
 * Here is where all the logic lives that pairs a particular kind of URI with its
 * resolving-URL-generating parser, what path to use to make a Bond request for an SA (if any), and
 * a response parser.
 */

function determineDrsType (parsedUrl) {
    const host = parsedUrl.host.toLowerCase();

    // First handle servers that we know about...

    if (['dg.4503', 'dg.712c'].includes(host)) {
        return new DrsType(
            dosCompactUrlGenerator,
            AUTH_SKIPPED,
            BOND_LINK_FENCE,
        );
    }

    if ((host === 'dg.anv0')) {
        return new DrsType(
            dosCompactUrlGenerator,
            AUTH_SKIPPED,
            BOND_LINK_ANVIL,
        );
    }

    if ((/jade.*\.datarepo-.*\.broadinstitute\.org/).test(host)) {
        return new DrsType(
            drsFullUrlGenerator,
            AUTH_REQUIRED,
            BOND_LINK_NONE,
        );
    }

    if (host.endsWith('.humancellatlas.org')) {
        return new DrsType(
            dosFullUrlGenerator,
            AUTH_SKIPPED,
            BOND_LINK_NONE,
        );
    }

    if (host.endsWith('.datacommons.io')) {
        return new DrsType(
            drsFullUrlGenerator,
            AUTH_REQUIRED,
            BOND_LINK_NONE,
        );
    }

    // If we don't recognize the server assume like martha_v2 that everyone else needs dcf-fence
    return new DrsType(
        host.startsWith('dg.') ? dosCompactUrlGenerator : dosFullUrlGenerator,
        AUTH_SKIPPED,
        BOND_LINK_DCF_FENCE,
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

    const {urlGenerator, sendAuth, bondLink} = determineDrsType(parsedUrl);
    const drsUrl = urlGenerator(parsedUrl);
    const bondUrl = bondLink && `${config.bondBaseUrl}/api/link/v1/${bondLink}/serviceaccount/key`;
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
