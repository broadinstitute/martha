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

/*
   Reference: https://stackoverflow.com/questions/28250090/javascript-comparisons-null-alternatives
 */
function isNullish(value) {
    return value === null || typeof value === "undefined";
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
    parsedUrl.hostname = hostnameRegExp.exec(rawUrl)[0];
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

/**
 * CommonFileInfoResponse contains the common properties for response between /martha_v3 and /fileSummaryV1
 */
class CommonFileInfoResponse {
    constructor(
        contentType,
        size,
        timeCreated,
        updated,
        bucket,
        name,
        gsUri,
        googleServiceAccount
    ) {
        this.contentType = contentType || null;
        this.size = size || null;
        this.timeCreated = timeCreated || null;
        this.updated = updated || null;
        this.bucket = bucket || null;
        this.name = name || null;
        this.gsUri = gsUri || null;
        this.googleServiceAccount = googleServiceAccount || null;
    }
}

/**
 * Response class for /martha_v3
 */
class MarthaV3Response extends CommonFileInfoResponse {
    constructor(
        contentType,
        size,
        timeCreated,
        updated,
        bucket,
        name,
        gsUri,
        googleServiceAccount,
        hashesMap
    ) {
        super(
            contentType,
            size,
            timeCreated,
            updated,
            bucket,
            name,
            gsUri,
            googleServiceAccount
        );
        this.hashes = hashesMap || null;
        this.timeUpdated = updated || null;
        delete this.updated;
    }
}

/**
 * Response class for /fileSummaryV1
 */
class FileSummaryV1Response extends CommonFileInfoResponse {
    constructor(
        contentType,
        size,
        timeCreated,
        updated,
        bucket,
        name,
        gsUri,
        googleServiceAccount,
        signedUrl,
        hash
    ) {
        super(
            contentType,
            size,
            timeCreated,
            updated,
            bucket,
            name,
            gsUri,
            googleServiceAccount
        );
        this.md5Hash = hash || '';
        this.signedUrl = signedUrl || '';
    }
}

/**
 * Response class for errors. The purpose behind this class is to have a consistent response format when there is an
 * error while resolving DRS uri. DRS servers and Bond usually return errors using the below format along
 * with additional response.headers and response.req information
 */
class FailureResponse {
    constructor(statusCode, message) {
        this.status = statusCode;
        this.response = {
            status: statusCode,
            text: message
        };
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

/**
 * Extracts the bucket and path from a Google Cloud Storage URL
 *
 * @param uri The GCS url
 * @returns {string[]} An array with the bucket and the path.
 */
function parseGsUri(uri) {
    const match = (/gs:[/][/]([^/]+)[/](.+)/).exec(uri);
    return isNullish(match) ? [] : match.slice(1);
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
 * Transforms the DOS or DRS checksum array into a map where `type` is key and `checksum` is value
 *
 * @param {Object[]} checksumArray The checksum of the drs object
 * @param {string} checksums[].checksum The hex-string encoded checksum for the data
 * @param {string} checksums[].type The digest method used to create the checksum
 * @returns {Object} The checksum map as an object
 * @throws {Error} throws an error if the checksums[] contains multiple checksum values for same hash type
 */
function getHashesMap(checksumArray) {
    // for undefined, null or empty array return null
    if (isNullish(checksumArray) || !(Array.isArray(checksumArray) && checksumArray.length)) {
        return null;
    }

    return checksumArray.reduce((hashMapAsObj, checksumObj) => {
        if (!Object.prototype.hasOwnProperty.call(hashMapAsObj, checksumObj.type)) {
            hashMapAsObj[checksumObj.type] = checksumObj.checksum;
            return hashMapAsObj;
        } else {
            throw new Error('Response from DRS Resolution server contained duplicate checksum values for' +
                ` hash type '${checksumObj.type}' in checksums array!`);
        }
    }, {});
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
 * Parses the DRS V1.x response into a MarthaV3Response.
 * NOTE: The response from this function is similar in syntax to the fileSummaryV1 response, however
 *   - instead of formatting dates with the undefined format returned by Date.prototype.toString(), this function
 *     returns dates formatted using ISO 8601.
 *   - the checksums array is converted to a map where `checksums[].type` is the key and `checksums[].checksum`
 *     becomes the value. This map is returned as an object through `hashes` property in the response
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
 * @param {Object} [googleSA] A google service account json
 * @returns {MarthaV3Response} The drs object converted to a martha file info response
 */
function convertToMarthaV3Response(drsResponse, googleSA) {
    const {
        checksums,
        created_time: createdTime,
        mime_type: mimeType = 'application/octet-stream',
        size,
        updated_time: updatedTime,
    } = drsResponse;

    const createdTimeIso = createdTime ? new Date(createdTime).toISOString() : null;
    const updatedTimeIso = updatedTime ? new Date(updatedTime).toISOString() : null;
    const googleServiceAccount = isNullish(googleSA) || Object.keys(googleSA).length === 0 ? null : googleSA;
    const gsUrl = getGsUrlFromDrsObject(drsResponse);
    const [bucket, name] = parseGsUri(gsUrl);
    const hashesMap = getHashesMap(checksums);

    return new MarthaV3Response(
        mimeType,
        size,
        createdTimeIso,
        updatedTimeIso,
        bucket,
        name,
        gsUrl,
        googleServiceAccount,
        hashesMap
    );
}

module.exports = {
    dataObjectUriToHttps,
    samBaseUrl,
    Response,
    promiseHandler,
    parseRequest,
    hasJadeDataRepoHost,
    getMd5Checksum,
    convertToMarthaV3Response,
    parseGsUri,
    getHashesMap,
    FileSummaryV1Response,
    MarthaV3Response,
    FailureResponse
};
