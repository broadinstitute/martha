const url = require('url');
const config = require('../config.json');

const dataGuidsHostPrefix = 'dg.';
const dosDataObjectPathPrefix = '/ga4gh/dos/v1/dataobjects/';
const drsDataObjectPathPrefix = '/ga4gh/drs/v1/objects/';
const jadeDataRepoHostRegex = /jade.*\.datarepo-.*\.broadinstitute\.org/;

// Regex drops any leading or trailing "/" characters and gives the path out of capture group 1
const pathSlashRegex = /^\/?([^/]+.*?)\/?$/;

const samBaseUrl = () => config.samBaseUrl;


function hasDataGuidsHost(someUrl) {
    return someUrl.host.startsWith(dataGuidsHostPrefix);
}

function hasJadeDataRepoHost(someUrl) {
    return jadeDataRepoHostRegex.test(someUrl.host);
}

function isDataGuidsUrl(someUrl) {
    return hasDataGuidsHost(someUrl) || (someUrl.hostname && !someUrl.pathname);
}

function validateDataObjectUrl(someUrl) {
    if ((hasDataGuidsHost(someUrl) || hasJadeDataRepoHost(someUrl)) && !someUrl.pathname) {
        throw new Error(`Data Object URIs with either '${dataGuidsHostPrefix}*' or '${jadeDataRepoHostRegex}' as host are required to have a path: "${url.format(someUrl)}"`);
    }
}

/**
 *  Filter off the null entries first (because `regex.exec(null)` is TRUTHY, because of course it is)
 *  Then run the regex to get the path part without leading or trailing slashes
 *  Then filter out the null values that didn't match the regex
 *  Then join the parts back together with "/"
 */
function constructPath(pathParts) {
    const formattedParts = pathParts.filter((part) => part)
        .map((part) => {
            const matches = pathSlashRegex.exec(part);
            return matches ? matches[1] : null;
        }).filter((part) => part);
    return formattedParts.join('/');
}

function determineHostname(someUrl) {
    return isDataGuidsUrl(someUrl) ? config.dataObjectResolutionHost : someUrl.hostname;
}

function determinePathname(someUrl) {
    if (isDataGuidsUrl(someUrl)) {
        return constructPath([dosDataObjectPathPrefix, someUrl.hostname, someUrl.pathname]);
    } else if (hasJadeDataRepoHost(someUrl)) {
        return constructPath([drsDataObjectPathPrefix, someUrl.pathname]);
    } else {
        return constructPath([dosDataObjectPathPrefix, someUrl.pathname]);
    }
}

/**
 * URI Scheme and Host parts are case insensitive:  https://stackoverflow.com/questions/15641694/are-uris-case-insensitive
 * When parsing a DOS URI into a resolvable HTTP URL, we use the Host part from the DOS URI in the Path part of the
 * resolution URL and that requires that the case be preserved.
 * @param parsedUrl
 * @param rawUrl
 */
function preserveHostnameCase(parsedUrl, rawUrl) {
    const hostnameRegExp = new RegExp(parsedUrl.hostname, 'i');
    parsedUrl.hostname = hostnameRegExp.exec(rawUrl)[0]
}

// 3 Scenarios we need to account for:
//      1. host part starts with "dg."
//      2. host part DOES NOT start with "dg." AND path part is FALSY
//      3. host part DOES NOT start with "dg." AND path part is TRUTHY
function dataObjectUriToHttps(dataObjectUri) {
    const parsedUrl = url.parse(dataObjectUri);
    if (parsedUrl.pathname === '/') {
        parsedUrl.pathname = null;
    }

    preserveHostnameCase(parsedUrl, dataObjectUri);

    validateDataObjectUrl(parsedUrl);

    const resolutionUrlParts = {
        protocol: 'https',
        hostname: determineHostname(parsedUrl),
        port: parsedUrl.port,
        pathname: determinePathname(parsedUrl),
        search: parsedUrl.search
    };

    const output = url.format(resolutionUrlParts);
    console.log(`Converting DRS URI to HTTPS: ${dataObjectUri} -> ${output}`);
    return output;
}

// This function counts on the request posing  data as "application/json" content-type.
// See: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests for more details
function parseRequest(req) {
    if (req && req.body) {
        return req.body.url;
    }
}

class FileInfoResponse {
    constructor(contentType, size, timeCreated, updated, md5Hash, bucket, name, gsUri, signedUrl) {
        this.contentType = contentType || '';
        this.size = size || 0;
        this.timeCreated = timeCreated || '';
        this.updated = updated || '';
        this.md5Hash = md5Hash || '';
        this.bucket = bucket || '';
        this.name = name || '';
        this.gsUri = gsUri || '';
        this.signedUrl = signedUrl || '';
    }
}

function convertToFileInfoResponse (contentType, size, timeCreated, updated, md5Hash, bucket, name, gsUri, signedUrl) {
    return new FileInfoResponse(
      contentType,
      size,
      timeCreated,
      updated,
      md5Hash,
      bucket,
      name,
      gsUri,
      signedUrl
    );
}


class Response {
    constructor(status, data) {
        this.status = status;
        this.data = data;
    }
}

const promiseHandler = (fn) => (req, res) => {
    const handleValue = (value) => {
        if (value instanceof Response) {
            res.status(value.status).send(value.data);
        } else {
            console.error(value);
            res.status(500).send(value.toString());
        }
    };
    return fn(req, res).then(handleValue, handleValue);
};

module.exports = {dataObjectUriToHttps, convertToFileInfoResponse, samBaseUrl, Response, promiseHandler, parseRequest};
