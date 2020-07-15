const { parseRequest, convertToMarthaV3Response, FailureResponse } = require('../common/helpers');
const config = require('../config.json');
const apiAdapter = require('../common/api_adapter');
const url = require('url');

const BAD_REQUEST_ERROR_CODE = 400;

class DrsType {
    constructor(drsUrl, bondUrl, responseParser) {
        this.drsUrl = drsUrl;
        this.bondUrl = bondUrl;
        this.responseParser = responseParser;
    }
}

const dosUrlGenerator = function (parsedUrl) {
    return url.format({
        protocol: 'https',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: '/ga4gh/dos/v1/dataobjects' + parsedUrl.pathname,
        search: parsedUrl.search
    });
}

const gen3UrlGenerator = function (parsedUrl) {
    const splitHost = parsedUrl.hostname.split('.');
    const idPrefix = splitHost[0] + '.' + splitHost[1].toUpperCase();
    return url.format({
        protocol: 'https',
        hostname: config.dataObjectResolutionHost,
        port: parsedUrl.port,
        pathname: '/ga4gh/dos/v1/dataobjects/' + idPrefix + parsedUrl.pathname,
        search: parsedUrl.search
    });
}

const jadeUrlGenerator = function (parsedUrl) {
    return url.format({
        protocol: 'https',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: '/ga4gh/drs/v1/objects' + parsedUrl.pathname,
        search: parsedUrl.search
    });
}

const dosResponseParser = function (response) {
    return {
        access_methods: response.data_object.urls.filter((e) => e.url.startsWith('gs://')).map((gsUrl) => new Object ({type: 'gs', access_url: {url: gsUrl.url}})),
        mime_type: response.data_object.mimeType || 'application/octet-stream',
        size: response.data_object.size,
        created_time: response.data_object.created,
        updated_time: response.data_object.updated,
        checksums: response.data_object.checksums
    };
}

const gen3ResponseParser = function (response) {
    return {
        mime_type: response.mimeType || 'application/octet-stream',
        size: response.size,
        created_time: response.createdTime,
        updated_time: response.updatedTime,
        checksums: response.checksums
    };
}

const jadeResponseParser = function (response) {
    return {
        mime_type: response.mimeType || 'application/octet-stream',
        size: response.size,
        created_time: response.createdTime,
        updated_time: response.updatedTime,
        checksums: response.checksums
    };
}

function determineDrsType (dataObjectUri, res) {
    const parsedUrl = url.parse(dataObjectUri);
    console.log('parsedUrl:');
    console.log(parsedUrl);

    if (parsedUrl.host.startsWith('dg.4503')) {
        return new DrsType(
            gen3UrlGenerator(parsedUrl),
            `${config.bondBaseUrl}/api/link/v1/dcf-fence/serviceaccount/key`,
            gen3ResponseParser);
    } else if (parsedUrl.host.startsWith('dg.')) {
        return new DrsType(
            gen3UrlGenerator(parsedUrl),
            `${config.bondBaseUrl}/api/link/v1/fence/serviceaccount/key`,
            dosResponseParser);
    } else if (parsedUrl.host.endsWith('dataguids.org')) {
        return new DrsType(
            gen3UrlGenerator(parsedUrl),
            null,
            gen3ResponseParser);
    } else if (parsedUrl.host.startsWith('jade.datarepo')) {
         return new DrsType(
             jadeUrlGenerator(parsedUrl),
             null,
             jadeResponseParser);
    } else {
        return new DrsType(
            dosUrlGenerator(parsedUrl),
            `${config.bondBaseUrl}/api/link/v1/fence/serviceaccount/key`,
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

    const {drsUrl, bondUrl, responseParser} = determineDrsType(dataObjectUri, res);

    console.log(`Converting DRS URI to HTTPS: ${dataObjectUri} -> ${drsUrl}`);
    let response;

    try {
        response = await apiAdapter.getJsonFrom(drsUrl, auth);
    } catch (err) {
        console.log('Received error while resolving drs url.');
        console.error(err);

        const errorStatusCode = err.status;
        if (typeof errorStatusCode === 'undefined') {
            const failureResponse = new FailureResponse(SERVER_ERROR_CODE, `Received error while resolving drs url. ${err.message}`);
            res.status(SERVER_ERROR_CODE).send(failureResponse);
        } else {
            res.status(errorStatusCode).send(err);
        }
        return;
    }
    const drsResponse = responseParser(response);

    let bondSA;
    if (bondUrl && req && req.headers && req.headers.authorization) {
        try {
            bondSA = await apiAdapter.getJsonFrom(bondUrl, auth);
        } catch (err) {
            console.log('Received error contacting Bond.');
            console.error(err);

            const errorStatusCode = err.status;
            if (typeof errorStatusCode === 'undefined') {
                const failureResponse = new FailureResponse(SERVER_ERROR_CODE, `Received error while resolving drs url. ${err.message}`);
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
