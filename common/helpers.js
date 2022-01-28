const url = require('url');
const config = require('../common/config');

const moment = require('moment');

const dataGuidsHostPrefix = 'dg.';
const dosDataObjectPathPrefix = '/ga4gh/dos/v1/dataobjects/';
const drsDataObjectPathPrefix = '/ga4gh/drs/v1/objects/';
const jadeDataRepoHostRegex = /.*data.*[-.](broadinstitute\.org|terra\.bio)$/;

const BAD_REQUEST_ERROR_CODE = 400;
const SERVER_ERROR_CODE = 500;

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

/* 2021-03-24 Do not call this method as written in new code! Gives wrong answers for data objects in
   CRDC, the AnVIL, and Kids First. Will probably give even more wrong answers in the future! */
function determineHostname(someUrl) {
    if (!isDataGuidsUrl(someUrl)) {
        return someUrl.hostname;
    }

    return config.bioDataCatalystLegacyHost;
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
// If you update this function update the README too!
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

// This function counts on the request posting data as "application/json" content-type.
// See: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests for more details
function parseRequest(req) {
    return (req && req.body) || {};
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
 *
 * For the curious, the fields are an evolution of:
 *     - It appears to have all started with the json schema for GCS objects...
 *         - `bucket`, `name`, `timeCreated`, `updated`, etc.
 *         - https://cloud.google.com/storage/docs/json_api/v1/objects#resource-representations
 *     - ...which was the inspiration for the `fileSummaryV1` endpoint (used by FireCloud-UI and not Terra-UI)...
 *     - ...which was partially merged with `martha_v2`...
 *         - `googleServiceAccount` was essentially added to `fileSummaryV1`
 *         - but `martha_v2` passed-thru whatever unstable response from the `dos` server while the specs keep evolving
 *     - ...which was then coalesced to what you see below for the `martha_v3` endpoint
 *         - `updated` was renamed to `timeUpdated`
 *         - The DOS/DRS optional `name` was added as `fileName`
 *         - etc.
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
        bondProvider,
        fileName,
        localizationPath,
        hashesMap,
        accessUrl,
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
        this.fileName = fileName || null;
        this.localizationPath = localizationPath || null;
        this.bondProvider = bondProvider || null;
        this.accessUrl = accessUrl || null;
        delete this.updated;
    }
}

// noinspection JSUnusedGlobalSymbols
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
 * @param {?string} uri The GCS URI
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
 * @param {string} checksumArray[].checksum The hex-string encoded checksum for the data
 * @param {string} checksumArray[].type The digest method used to create the checksum
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
 * @returns {(string|undefined)} The gs access url if found
 */
function getGsUrlFromDrsObject(drsResponse) {
    if (!drsResponse) { return; }
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
 * @param {?Object} [drsResponse] DRS v1.x response
 * @param {string} [drsResponse.name] A string that can be used to name a drs object
 * @param {Object[]} [drsResponse.access_methods] The list of access methods that can be used to fetch the drs object
 * @param {Object} [drsResponse.access_methods[].access_url] An AccessURL that can be used to fetch the actual object
 *     bytes
 * @param {string} [drsResponse.access_methods[].access_url.url] A fully resolvable URL that can be used to fetch the
 *     actual object bytes
 * @param {string} [drsResponse.access_methods[].type] Type of the access method
 * @param {Object[]} [drsResponse.checksums] The checksum of the drs object
 * @param {string} [drsResponse.checksums[].checksum] The hex-string encoded checksum for the data
 * @param {string} [drsResponse.checksums[].type] The digest method used to create the checksum
 * @param {string} [drsResponse.created_time] Timestamp of content creation in RFC3339
 * @param {string} [drsResponse.mime_type] A string providing the mime-type of the drs object
 * @param {number} [drsResponse.size] The blob size in bytes
 * @param {string} [drsResponse.updated_time] Timestamp of content update in RFC3339, identical to created_time in
 *     systems that do not support updates
 * @param {?string} [fileName] The file name
 * @param {?string} [bondProvider] The Bond provider
 * @param {?Object} [googleSA] A google service account json
 * @param {?Object} [accessUrl] An access URL
 * @param {string} accessUrl.url A URL used to fetch object bytes
 * @param {?Object} [accessUrl.headers] The optional headers to include in the HTTP request to url
 * @param {?string} [localizationPath] The preferred localization path
 * @returns {MarthaV3Response} The drs object converted to a martha_v3 response
 */
function convertToMarthaV3Response(drsResponse, fileName, bondProvider, googleSA, accessUrl, localizationPath) {
    const {
        checksums,
        mime_type: mimeType = 'application/octet-stream',
        size: maybeNumberSize,
        created_time: createdTime,
        updated_time: updatedTime,
    } = drsResponse || {};

    // Some (but not all!) DRS servers return time without a timezone (see example responses in `_martha_v3_resources.js`)
    // Instead of letting JS assume that a timezoneless time is local TZ, explicitly assign it to be UTC
    const createdTimeIso = createdTime ? moment.utc(createdTime).toISOString() : null;
    const updatedTimeIso = updatedTime ? moment.utc(updatedTime).toISOString() : null;

    const googleServiceAccount = isNullish(googleSA) || Object.keys(googleSA).length === 0 ? null : googleSA;
    const gsUrl = getGsUrlFromDrsObject(drsResponse);
    const [bucket, name] = parseGsUri(gsUrl);
    const hashesMap = getHashesMap(checksums);

    /*
    Some servers return the size as a JSON string and not a JSON number.

      curl \
        https://drs.data.humancellatlas.org/ga4gh/dos/v1/dataobjects/4cf48dbf-cf09-452e-bb5b-fd016af0c747 |
        jq .data_object.size

      returns `"148"`

    vs.

      curl \
        https://dataguids.org/ga4gh/dos/v1/dataobjects/a41b0c4f-ebfb-4277-a941-507340dea85d |
        jq .data_object.size

      returns `39830`
     */
    const size = Number(maybeNumberSize);

    return new MarthaV3Response(
        mimeType,
        size,
        createdTimeIso,
        updatedTimeIso,
        bucket,
        name,
        gsUrl,
        googleServiceAccount,
        bondProvider,
        fileName,
        localizationPath,
        hashesMap,
        accessUrl,
    );
}

class BadRequestError extends Error {
}

class RemoteServerError extends Error {
    constructor(cause, description) {
        super(cause.message);
        this.cause = cause;
        this.description = description;
    }
}

/**
 * A SuperAgent exception contains...
 *      the Response object which contains...
 *      the ClientRequest object which contains...
 *      the request headers which may contain...
 *      authorization tokens!
 * We don't want to log authorization tokens.
 * Therefore, whenever we log an error, we need to either:
 *      * filter out the pieces that we suspect could contain tokens
 *      * pick specific pieces that are safe to log
 * To avoid the risk of authorization tokens slipping through a filter, we instead select specific
 * properties to include in the Error being logged.
 *
 * @param error an Error thrown from SuperAgent; behavior is undefined if not an Error object
 */
function makeLogSafeRequestError(error) {
    if (error && error.response && typeof error.response === 'object') { // looks like an Error from SuperAgent (or maybe any request-like API?)
        // Even though the new error will have a new stacktrace, error.response.error still has the
        // original stacktrace. In fact, this new Error's stacktrace might be more useful anyway.
        const newError = new Error(error.message);
        newError.status = error.status;
        newError.response = { error: error.response.error };
        return newError;
    } else { // some other kind of error; let's return the original error to preserve the stacktrace
        return error;
    }
}

function logAndSendBadRequest(res, error) {
    console.error(makeLogSafeRequestError(error));
    const failureResponse = new FailureResponse(BAD_REQUEST_ERROR_CODE, `Request is invalid. ${error.message}`);
    res.status(BAD_REQUEST_ERROR_CODE).send(failureResponse);
}

function logAndSendServerError(res, error, description) {
    console.error(description);
    console.error(makeLogSafeRequestError(error));

    let message = error.message;

    /*
    Parse superagent responses
    https://visionmedia.github.io/superagent/#response-text
     */
    if (error.response && error.response.text) {
        message = error.response.text;
    }

    /*
    Parse Bond responses
     */
    try {
        const messageObject = JSON.parse(message);
        if (messageObject.error && messageObject.error.message) {
            message = messageObject.error.message;
        }
    } catch {
        /* ignore */
    }

    const errorStatusCode = isNullish(error.status) ? SERVER_ERROR_CODE : error.status;
    const failureResponse = new FailureResponse(errorStatusCode, `${description} ${message}`);
    res.status(errorStatusCode).send(failureResponse);
}

const delay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

module.exports = {
    dataObjectUriToHttps,
    samBaseUrl,
    Response,
    promiseHandler,
    parseRequest,
    jadeDataRepoHostRegex,
    hasJadeDataRepoHost,
    getMd5Checksum,
    convertToMarthaV3Response,
    parseGsUri,
    getHashesMap,
    FileSummaryV1Response,
    MarthaV3Response,
    FailureResponse,
    BadRequestError,
    RemoteServerError,
    makeLogSafeRequestError,
    logAndSendBadRequest,
    logAndSendServerError,
    delay,
};
