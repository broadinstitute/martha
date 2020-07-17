const { parseRequest, convertToMarthaV3Response, FailureResponse } = require('../common/helpers');
const config = require('../config.json');
const apiAdapter = require('../common/api_adapter');
const url = require('url');

const BAD_REQUEST_ERROR_CODE = 400;
const SERVER_ERROR_CODE = 500;

class DrsType {
    constructor(drsUrl, sendAuth, bondUrl, responseParser) {
        this.drsUrl = drsUrl;
        this.sendAuth = sendAuth;
        this.bondUrl = bondUrl;
        this.responseParser = responseParser;
    }
}

/** *************************************************************************************************
 * URI parsers
 */

function dosFullUrlGenerator (parsedUrl) {
    return url.format({
        protocol: 'https',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: `/ga4gh/dos/v1/dataobjects${parsedUrl.pathname}`,
        search: parsedUrl.search
    });
}

function dosCompactUrlGenerator (parsedUrl) {
    const splitHost = parsedUrl.hostname.split('.');
    const idPrefix = `${splitHost[0]}.${splitHost[1].toUpperCase()}`;
    return url.format({
        protocol: 'https',
        hostname: config.dataObjectResolutionHost,
        port: parsedUrl.port,
        pathname: `/ga4gh/dos/v1/dataobjects/${idPrefix}${parsedUrl.pathname}`,
        search: parsedUrl.search
    });
}

function drsFullUrlGenerator (parsedUrl) {
    return url.format({
        protocol: 'https',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: `/ga4gh/drs/v1/objects${parsedUrl.pathname}`,
        search: parsedUrl.search
    });
}

/** *************************************************************************************************
 * Response parsers
 */

function dosResponseParser (response) {
    if (response.data_object) {
        const accessMethods = (response.data_object.urls) ? response.data_object.urls
            .filter((e) => e.url.startsWith('gs://'))
            .map((gsUrl) => {
                return { type: 'gs', access_url: { url: gsUrl.url } };
            }) : null;
        return {
            access_methods: accessMethods,
            checksums: response.data_object.checksums,
            created_time: response.data_object.created,
            mime_type: response.data_object.mimeType,
            size: response.data_object.size,
            updated_time: response.data_object.updated,
        };
    } else {
        throw new FailureResponse(400, `Expected but did not receive properly formatted DOS Response: ${JSON.stringify(response)} `);
    }
}

function drsResponseParser (response) {
    return {
        access_methods: response.access_methods,
        checksums: response.checksums,
        created_time: response.created_time,
        mime_type: response.mime_type,
        name: response.name,
        size: response.size,
        updated_time: response.updated_time,
    };
}

/** *************************************************************************************************
 * Here is where all the logic lives that pairs a particular kind of URI with its
 * resolving-URL-generating parser, what path to use to make a Bond request for an SA (if any), and
 * a response parser.
 */

function determineDrsType (parsedUrl) {
    if ((parsedUrl.host.toLowerCase() === 'dg.4503') || (parsedUrl.host.toLowerCase() === 'dg.712c')) {
        return new DrsType(
            dosCompactUrlGenerator(parsedUrl),
            false,
            `${config.bondBaseUrl}/api/link/v1/fence/serviceaccount/key`,
            dosResponseParser);
    } else if (parsedUrl.host.toLowerCase().startsWith('dg.')) {
        return new DrsType(
            dosCompactUrlGenerator(parsedUrl),
            false,
            `${config.bondBaseUrl}/api/link/v1/dcf-fence/serviceaccount/key`,
            dosResponseParser);
    } else if (parsedUrl.host.endsWith('.dataguids.org')) {
        return new DrsType(
            dosCompactUrlGenerator(parsedUrl),
            false,
            null,
            dosResponseParser);
    } else if ((/jade.*\.datarepo-.*\.broadinstitute\.org/).test(parsedUrl.host)) {
        return new DrsType(
            drsFullUrlGenerator(parsedUrl),
            null,
            drsResponseParser);
    } else if (parsedUrl.host.endsWith('.humancellatlas.org')) {
        return new DrsType(
            dosFullUrlGenerator(parsedUrl),
            false,
            null,
            dosResponseParser);
    } else {
        return new DrsType(
            dosFullUrlGenerator(parsedUrl),
            false,
            `${config.bondBaseUrl}/api/link/v1/dcf-fence/serviceaccount/key`,
            dosResponseParser);
    }
}

function validateRequest(dataObjectUri, auth) {
    if (!dataObjectUri) {
        throw new Error('URL of a DRS object is missing.');
    } else if (!auth) {
        throw new Error('Authorization header is missing.');
    }
}

async function marthaV3Handler(req, res) {
    const dataObjectUri = parseRequest(req);
    const auth = req.headers.authorization;
    console.log(`Received URL '${dataObjectUri}' from IP '${req.ip}'`);

    try {
        validateRequest(dataObjectUri, auth);
    } catch (error) {
        console.error(error);
        const failureResponse = new FailureResponse(BAD_REQUEST_ERROR_CODE, `Request is invalid. ${error.message}`);
        res.status(BAD_REQUEST_ERROR_CODE).send(failureResponse);
        return;
    }
    const parsedUrl = url.parse(dataObjectUri);
    if (!parsedUrl.host || !parsedUrl.path) {
        console.error(`"${url.format(parsedUrl)}" is missing a host and/or a path.`);
        const failureResponse = new FailureResponse(BAD_REQUEST_ERROR_CODE, `"${dataObjectUri}" is not a properly-formatted URI.`);
        res.status(BAD_REQUEST_ERROR_CODE).send(failureResponse);
        return;
    }
    const {drsUrl, sendAuth, bondUrl, responseParser} = determineDrsType(parsedUrl);
    console.log(`Converting DRS URI to HTTPS: ${dataObjectUri} -> ${drsUrl}`);

    let response;
    try {
        if (sendAuth) {
            response = await apiAdapter.getJsonFrom(drsUrl, auth);
        } else {
            response = await apiAdapter.getJsonFrom(drsUrl);
        }
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
    if (bondUrl && req && req.headers && req.headers.authorization) {
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
