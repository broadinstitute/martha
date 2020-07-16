const { parseRequest, convertToMarthaV3Response, FailureResponse } = require('../common/helpers');
const config = require('../config.json');
const apiAdapter = require('../common/api_adapter');
const url = require('url');

const BAD_REQUEST_ERROR_CODE = 400;
const SERVER_ERROR_CODE = 500;

class DrsType {
    constructor(drsUrl, bondUrl, responseParser) {
        this.drsUrl = drsUrl;
        this.bondUrl = bondUrl;
        this.responseParser = responseParser;
    }
}

/** *************************************************************************************************
 * URI parsers
 * These are used to generate the resolving URL for a URI based on (unfortunately) somewhat
 * arbitrary rules, hence the names are not particularly illuminating.  The dream is that,
 * sometime in the future, the conventions will coalesce into something more sensible, but, at the
 * moment, this is not the case -- hic sunt dracones.
 */

function alphaUrlGenerator (parsedUrl) {
    return url.format({
        protocol: 'https',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: `/ga4gh/dos/v1/dataobjects${parsedUrl.pathname}`,
        search: parsedUrl.search
    });
}

function bravoUrlGenerator (parsedUrl) {
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

function charlieUrlGenerator (parsedUrl) {
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
 * These are used to take the various kinds of responses that come from the supported data URI
 * resolvers and generate a standard object from that response.  Like with the URI parsers, the
 * distinctions are (unfortunately) somewhat arbitrary rules, hence the names are also not
 * illuminating -- hic sunt dracones.
 */

function amsterdamResponseParser (response) {
    if (response.data_object) {
        const accessMethods = (response.data_object.urls) ? response.data_object.urls
            .filter((e) => e.url.startsWith('gs://'))
            .map((gsUrl) => {
                return { type: 'gs', access_url: { url: gsUrl.url } };
            }) : null;
        console.log(response.data_object.urls)
        console.log(accessMethods)
        return {
            access_methods: accessMethods,
            checksums: response.data_object.checksums,
            created_time: response.data_object.created,
            mime_type: response.data_object.mimeType || 'application/octet-stream',
            size: response.data_object.size,
            updated_time: response.data_object.updated,
        };
    }
}

function baltimoreResponseParser (response) {
    return {
        checksums: response.checksums,
        created_time: response.createdTime,
        mime_type: response.mimeType || 'application/octet-stream',
        size: response.size,
        updated_time: response.updatedTime,
    };
}

function casablancaResponseParser (response) {
    return {
        access_methods: response.access_methods,
        checksums: response.checksums,
        created_time: response.created_time,
        mime_type: response.mime_type || 'application/octet-stream',
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
    if (parsedUrl.host.toLowerCase().startsWith('dg.4503')) {
        return new DrsType(
            bravoUrlGenerator(parsedUrl),
            `${config.bondBaseUrl}/api/link/v1/fence/serviceaccount/key`,
            baltimoreResponseParser);
    } else if (parsedUrl.host.toLowerCase().startsWith('dg.')) {
        return new DrsType(
            bravoUrlGenerator(parsedUrl),
            `${config.bondBaseUrl}/api/link/v1/dcf-fence/serviceaccount/key`,
            amsterdamResponseParser);
    } else if (parsedUrl.host.endsWith('.dataguids.org')) {
        return new DrsType(
            bravoUrlGenerator(parsedUrl),
            null,
            baltimoreResponseParser);
    } else if ((/jade.*\.datarepo-.*\.broadinstitute\.org/).test(parsedUrl.host)) {
        return new DrsType(
            charlieUrlGenerator(parsedUrl),
            null,
            casablancaResponseParser);
    } else if (parsedUrl.host.endsWith('.humancellatlas.org')) {
        return new DrsType(
            alphaUrlGenerator(parsedUrl),
            null,
            amsterdamResponseParser);
    } else {
        return new DrsType(
            alphaUrlGenerator(parsedUrl),
            `${config.bondBaseUrl}/api/link/v1/dcf-fence/serviceaccount/key`,
            amsterdamResponseParser);
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
        const failureResponse = new FailureResponse(BAD_REQUEST_ERROR_CODE, `"${url.format(parsedUrl)}" is not a properly-formatted URI.`);
        res.status(BAD_REQUEST_ERROR_CODE).send(failureResponse);
        return;
    }
    const {drsUrl, bondUrl, responseParser} = determineDrsType(parsedUrl);
    console.log(`Converting DRS URI to HTTPS: ${dataObjectUri} -> ${drsUrl}`);

    let response;
    try {
        response = await apiAdapter.getJsonFrom(drsUrl, auth);
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
    console.log(`response for ${dataObjectUri}:` + "\n")
    console.log(response)

    const drsResponse = responseParser(response);

    console.log(`parsed response for ${dataObjectUri}:` + "\n")
    console.log(drsResponse)

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
