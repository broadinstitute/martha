const url = require('url');
const config = require('../config.json');
const { Storage } = require('@google-cloud/storage');

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

// This function counts on the request posing data as "application/json" content-type.
// See: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests for more details
function parseRequest(req) {
    if (req && req.body) {
        return req.body.url;
    }
}

class FileInfoResponse {
    constructor(
        contentType,
        size,
        timeCreated,
        updated,
        md5Hash,
        bucket,
        name,
        gsUri,
        googleServiceAccount,
        signedUrl,
    ) {
        this.contentType = contentType || '';
        this.size = size || 0;
        this.timeCreated = timeCreated || '';
        this.updated = updated || '';
        this.md5Hash = md5Hash || '';
        this.bucket = bucket || '';
        this.name = name || '';
        this.gsUri = gsUri || '';
        this.googleServiceAccount = googleServiceAccount || null;
        this.signedUrl = signedUrl || '';
    }
}

function convertToFileInfoResponse (
    contentType,
    size,
    timeCreated,
    updated,
    md5Hash,
    bucket,
    name,
    gsUri,
    googleServiceAccount,
    signedUrl,
) {
    return new FileInfoResponse(
      contentType,
      size,
      timeCreated,
      updated,
      md5Hash,
      bucket,
      name,
      gsUri,
      googleServiceAccount,
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

async function createSignedGsUrl(serviceAccountKey, {bucket, object}) {
    const storage = new Storage({ credentials: serviceAccountKey });
    const response = await storage.bucket(bucket).file(object).getSignedUrl({ action: 'read', expires: Date.now() + 36e5 });
    return response[0];
}

/**
 * Extracts the bucket and path from a Google Cloud Storage URL
 *
 * @param uri The GCS url
 * @returns {string[]} An array with the bucket and the path.
 */
function parseGsUri(uri) {
    return /gs:[/][/]([^/]+)[/](.+)/.exec(uri).slice(1);
}

/**
 * Retrieves the first md5 checksum from a DOS or DRS checksum array
 *
 * @param {Object[]} checksums The checksum of the drs object
 * @param {string} checksums[].checksum The hex-string encoded checksum for the data
 * @param {string} checksums[].type The digest method used to create the checksum
 * @returns {string} The md5 checksum if found
 */
function getMd5Checksum(checksums) {
    return (checksums.find((e) => e.type === 'md5') || {}).checksum;
}

/**
 * Finds the GCS/GS access url if present in the DRS V1.x response
 *
 * @param {Object} drsResponse DRS v1.x response
 * @param {Object[]} [drsResponse.access_methods] The list of access methods that can be used to fetch the drs object
 * @param {Object} [drsResponse.access_methods[].access_url] An AccessURL that can be used to fetch the actual object
 *     bytes
 * @param {string} drsResponse.access_methods[].access_url.url A fully resolvable URL that can be used to fetch the
 *     actual object bytes
 * @returns {string} The gs access url if found
 */
function getGsUrlFromDrsObject(drsResponse) {
    const accessMethods = drsResponse.access_methods || [];
    const gsAccessMethod = accessMethods.find((e) => e.type === 'gs') || {};
    const gsAccessUrl = gsAccessMethod.access_url || {};
    return gsAccessUrl.url;
}

/**
 * Parses the DRS V1.x response into a FileInfoResponse. NOTE: The response from this function is similar in syntax to
 * the fileSummaryV1 response, however instead of formatting dates with the undefined format returned by
 * Date.prototype.toString(), this function returns dates formatted using ISO 8601.
 *
 * Input fields are defined by:
 *     https://ga4gh.github.io/data-repository-service-schemas/preview/release/drs-1.0.0/docs/
 *
 * @param {Object} drsResponse DRS v1.x response
 * @param {Object[]} [drsResponse.access_methods] The list of access methods that can be used to fetch the drs object
 * @param {Object} [drsResponse.access_methods[].access_url] An AccessURL that can be used to fetch the actual object
 *     bytes
 * @param {string} drsResponse.access_methods[].access_url.url A fully resolvable URL that can be used to fetch the
 *     actual object bytes
 * @param {string} drsResponse.access_methods[].type Type of the access method
 * @param {Object[]} drsResponse.checksums The checksum of the drs object
 * @param {string} drsResponse.checksums[].checksum The hex-string encoded checksum for the data
 * @param {string} drsResponse.checksums[].type The digest method used to create the checksum
 * @param {string} drsResponse.created_time Timestamp of content creation in RFC3339
 * @param {string} [drsResponse.mime_type] A string providing the mime-type of the drs object
 * @param {number} drsResponse.size The blob size in bytes
 * @param {string} [drsResponse.updated_time] Timestamp of content update in RFC3339, identical to created_time in
 *     systems that do not support updates
 * @param {Object} [googleServiceAccount] A google service account json
 * @returns {FileInfoResponse} The drs object converted to a martha file info response
 */
function getFileInfoFromDrsResponse(drsResponse, googleServiceAccount) {
    const {
        mime_type: mimeType = 'application/octet-stream',
        size,
        created_time: createdTime,
        updated_time: updatedTime,
        checksums,
    } = drsResponse;

    const createdTimeIso = createdTime ? new Date(createdTime).toISOString() : null;
    const updatedTimeIso = updatedTime ? new Date(updatedTime).toISOString() : null;
    const gsUrl = getGsUrlFromDrsObject(drsResponse);
    const [bucket, name] = parseGsUri(gsUrl);
    const md5Checksum = getMd5Checksum(checksums);
    const signedUrl = null; // Not included currently when returning only the drs metadata

    return convertToFileInfoResponse(
        mimeType,
        size,
        createdTimeIso,
        updatedTimeIso,
        md5Checksum,
        bucket,
        name,
        gsUrl,
        googleServiceAccount,
        signedUrl,
    );
}

module.exports = {
    dataObjectUriToHttps,
    convertToFileInfoResponse,
    samBaseUrl,
    Response,
    promiseHandler,
    createSignedGsUrl,
    parseRequest,
    hasJadeDataRepoHost,
    getMd5Checksum,
    getFileInfoFromDrsResponse,
    parseGsUri,
};
