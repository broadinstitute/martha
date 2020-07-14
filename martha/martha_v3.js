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

const gen3UrlGenerator = function (parsedUrl) {
    return {
        protocol: 'https',
        host: config.dataObjectResolutionHost,
        port: parsedUrl.port,
        path: parsedUrl.path + '/ga4gh/drs/v1/objects/',
        search: parsedUrl.search
    } |> url.format;
}

const jadeUrlGenerator = function (parsedUrl) {
    return {
        protocol: 'https',
        host: 'jade.datarepo-dev.broadinstitute.org',
        port: parsedUrl.port,
        path: '/ga4gh/drs/v1/objects/',
        search: parsedUrl.search
    } |> url.format;
}

const hcaUrlGenerator = function (parsedUrl) {
    return {
        protocol: 'https',
        host: 'drs.data.humancellatlas.org',
        port: parsedUrl.port,
        path: '/ga4gh/drs/v1/objects/',
        search: parsedUrl.search
    } |> url.format;
}

const gen3ResponseParser = async function (response) {
    return {
        mime_type: mimeType = 'application/octet-stream',
        size,
        created_time: createdTime,
        updated_time: updatedTime,
        checksums,
    };
}

const hcaResponseParser = async function (response) {
    return {
        mime_type: mimeType = 'application/octet-stream',
        size,
        created_time: createdTime,
        updated_time: updatedTime,
        checksums,
    };
}

const jadeResponseParser = async function (response) {
    return {
        mime_type: mimeType = 'application/octet-stream',
        size,
        created_time: createdTime,
        updated_time: updatedTime,
        checksums,
    };
}

/*
 Url {
 protocol: 'drs:',
 host: 'dg.712c',
 path: '/fa640b0e-9779-452f-99a6-16d833d15bd0',
 href: 'drs://dg.712c/fa640b0e-9779-452f-99a6-16d833d15bd0'
 }
 */

function determineDrsType (dataObjectUri, res) {
    const parsedUrl = url.parse(dataObjectUri);
    console.log('parsedUrl:');
    console.log(parsedUrl);

    if (parsedUrl.host.startsWith('dg.4503')) {
        return new DrsType(
            gen3UrlGenerator(parsedUrl),
            `${config.bondBaseUrl}/api/link/v1/dcf-fence/serviceaccount/key`,
            gen3ResponseParser);
    }else if (parsedUrl.host.startsWith('dg.')) {
        return new DrsType(
            gen3UrlGenerator(parsedUrl),
            `${config.bondBaseUrl}/api/link/v1/fence/serviceaccount/key`,
            gen3ResponseParser);
    } else if (parsedUrl.host.endsWith('dataguids.org')) {
        return new DrsType(
            gen3UrlGenerator(parsedUrl),
            null,
            gen3ResponseParser);
    } else if (parsedUrl.host.endsWith('humancellatlas.org')) {
         return new DrsType(
             hcaUrlGenerator(parsedUrl),
             null,
             hcaResponseParser);
    } else if (parsedUrl.host.startsWith('jade.datarepo')) {
         return new DrsType(
             jadeUrlGenerator(parsedUrl),
             null,
             jadeResponseParser);
    } else {
        const failureResponse = new FailureResponse(BAD_REQUEST_ERROR_CODE, `The specified URI '${dataObjectUri}' is not of a recognizable format.`);
        res.status(BAD_REQUEST_ERROR_CODE).send(failureResponse);
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
    const drsResponse = responseParser(await apiAdapter.getJsonFrom(drsUrl, auth));
    let bondSA;
    if (bondUrl && req && req.headers && req.headers.authorization) {
        bondSA =  await apiAdapter.getJsonFrom(bondUrl, req.headers.authorization);
    }

    res.status(200).send(convertToMarthaV3Response(drsResponse, bondSA));
}

exports.marthaV3Handler = marthaV3Handler;
