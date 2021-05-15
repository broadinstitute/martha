const request = require('superagent');
const sleep = require('util').promisify(setTimeout);

const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_BACKOFF_DELAY = 1000;
const BACKOFF_FACTOR = 2;

const GCS_REQUESTER_PAYS_MESSAGE = 'Bucket is a requester pays bucket but no user project provided.';

const BAD_REQUEST_CODE = 400;
const FORBIDDEN_CODE = 403;
const TOO_MANY_REQUESTS_CODE = 429;
const SERVER_ERROR_CODE = 500;
const NETWORK_AUTH_REQ_CODE = 511;

class EmptyBodyError extends Error {
}

function get(method, url, authorization) {
    const req = request[method](url);
    if (authorization) {
        req.set('authorization', authorization);
    }

    console.log(`Making Request: ${JSON.stringify(req)}`);
    return req;
}

async function getHeaders(url, authorization) {
    try {
        const {headers} = await get('head', url, authorization);
        return headers;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Returns true if a an error requester pays.
 */
function isGcsRequesterPaysError(error) {
    if (![BAD_REQUEST_CODE, FORBIDDEN_CODE].includes(error.status)) {
        return false;
    }

    return error.response &&
        error.response.text &&
        error.response.text.includes(GCS_REQUESTER_PAYS_MESSAGE);
}

/**
 * Returns true if a URL is GCS and requires requester pays.
 *
 * Throws any other errors that occur accessing the URL.
 */
async function isGcsRequesterPaysUrl(url) {
    if (!url.includes('googleapis.com')) {
        console.log(`URL is not GCS: '${url}'`);
        return false;
    }

    if (url.includes('userProject')) {
        console.log(`GCS URL already contains 'userProject': '${url}'`);
        return false;
    }

    try {
        const req = request.get(url);
        req.set('Range', 'bytes=0-0');
        await req;
        console.log(`GCS URL is not requester pays: '${url}'`);
        return false;
    } catch (error) {
        if (isGcsRequesterPaysError(error)) {
            return true;
        }
        console.log(`GCS URL request failed with status ${error.status}: '${JSON.stringify(error.response)}'`);
        throw error;
    }
}

/**
 * Returns the body only if it is non-empty, otherwise throws an EmptyBodyError.
 */
function nonEmptyBody(body, url, retryAttempt) {
    if (Object.keys(body).length === 0) {
        console.log(`Received an empty JSON body while trying to resolve url '${url}'. Attempt ${retryAttempt}.`);
        throw new EmptyBodyError(
            `Something went wrong while trying to resolve url '${url}'. It came back with empty JSON body!`
        );
    }

    console.log(`Successfully received response from url '${url}'.`);
    return body;
}

function shouldRetry(error) {
    if (error.status) {
        if (SERVER_ERROR_CODE <= error.status && error.status <= NETWORK_AUTH_REQ_CODE) {
            return true;
        }

        if (error.status === TOO_MANY_REQUESTS_CODE) {
            return true;
        }
    }

    return error instanceof EmptyBodyError;
}

async function getJsonFrom(url, authorization, retryAttempt = 1, delay = INITIAL_BACKOFF_DELAY) {
    try {
        const {body} = await get('get', url, authorization);
        return nonEmptyBody(body, url, retryAttempt);
    } catch (error) {
        /*
        WA-90: If a server is struggling, hit it again and again and again. GCFs only live 60 seconds at a time, so
        this requested WA-90 behavior ends up potentially hammering ailing servers.

        See also more patient retries outside of this 60 second GCF:
        - https://github.com/broadinstitute/cromwell/blob/60/cloud-nio/cloud-nio-impl-drs/src/main/scala/cloud/nio/impl/drs/DrsPathResolver.scala#L22
        - https://github.com/broadinstitute/rawls/blob/54e9cc8f9dab2b8e3832ccd00aa6d7a0eba7e8f6/core/src/main/scala/org/broadinstitute/dsde/rawls/dataaccess/martha/MarthaResolver.scala#L30

        `sleep` via:
        - https://stackoverflow.com/questions/33289726/combination-of-async-function-await-settimeout#answer-51939030
        - https://stackoverflow.com/questions/14249506/how-can-i-wait-in-node-js-javascript-l-need-to-pause-for-a-period-of-time#answer-46900495
        Not sure why IntelliJ cannot see that sleep takes parameters, so silencing the inspection for now.
         */

        console.log(`Received error for url '${url}'. Attempt ${retryAttempt}.`);
        console.error(error);

        if (retryAttempt >= MAX_RETRY_ATTEMPTS) {
            throw error;
        }

        if (!shouldRetry(error)) {
            throw error;
        }

        console.log(`Failed to resolve url '${url}'. Attempt ${retryAttempt}. Will retry after ${delay} ms.`);
        // noinspection JSCheckFunctionSignatures
        await sleep(delay);
        await getJsonFrom(url, authorization, retryAttempt + 1, delay * BACKOFF_FACTOR);
    }
}

function postJsonTo(url, authorization, payload) {
    const postReq = request.post(url, payload);
    postReq.set('Content-Type', 'application/json');
    if (authorization) {
        postReq.set('authorization', authorization);
    }

    return postReq.then((response) => response.body);
}

module.exports = {
    GCS_REQUESTER_PAYS_MESSAGE,
    BAD_REQUEST_CODE,
    FORBIDDEN_CODE,
    TOO_MANY_REQUESTS_CODE,
    SERVER_ERROR_CODE,
    NETWORK_AUTH_REQ_CODE,
    EmptyBodyError,
    get,
    getHeaders,
    isGcsRequesterPaysUrl,
    getJsonFrom,
    postJsonTo,
};
