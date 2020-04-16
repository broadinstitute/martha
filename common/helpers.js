const url = require('url');
const config = require('../config.json');

const dataGuidsHostPrefix = 'dg.';
const dataObjectPathPrefix = '/ga4gh/dos/v1/dataobjects/';

function hasDataGuidsHost(someUrl) {
    return someUrl.host.startsWith(dataGuidsHostPrefix);
}

function isDataGuidsUrl(someUrl) {
    return hasDataGuidsHost(someUrl) || (someUrl.hostname && !someUrl.pathname);
}

function validateDataObjectUrl(someUrl) {
    if (hasDataGuidsHost(someUrl) && !someUrl.pathname) {
        throw new Error(`Data Object URIs with '${dataGuidsHostPrefix}*' host are required to have a path: "${url.format(someUrl)}"`);
    }
}

// Regex drops any leading or trailing "/" characters and gives the path out of capture group 1
const pathSlashRegex = /^\/?([^/]+.*?)\/?$/;
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
        return constructPath([dataObjectPathPrefix, someUrl.hostname, someUrl.pathname]);
    } else {
        return constructPath([dataObjectPathPrefix, someUrl.pathname]);
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

const samBaseUrl = () => config.samBaseUrl;

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

module.exports = {dataObjectUriToHttps, convertToFileInfoResponse, samBaseUrl, Response, promiseHandler};
