const request = require('superagent');
const { FailureResponse, makeLogSafeRequestError } = require('../common/helpers');

const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_BACKOFF_DELAY = 1000;
const BACKOFF_FACTOR = 2;

const TOO_MANY_REQUESTS_CODE = 429;
const SERVER_ERROR_CODE = 500;
const NETWORK_AUTH_REQ_CODE = 511;

function get(method, url, authorization) {
    const req = request[method](url);
    if (authorization) {
        req.set('authorization', authorization);
    }

    console.log(`Making Request: ${JSON.stringify({ method: req.method, url: req.url })}`);
    return req;
}

async function getHeaders(url, authorization) {
    try {
        const {headers} = await get('head', url, authorization);
        return headers;
    } catch (error) {
        console.error(makeLogSafeRequestError(error));
        throw error;
    }
}

async function httpCallWithRetry(url, httpCall, retryAttempt = 1, delay = INITIAL_BACKOFF_DELAY) {
    try {
        const response = await httpCall();
        console.log(`Successfully received response from url '${url}'.`);
        return response;
    } catch (error) {
        console.log(`Received error for url '${url}'. Attempt ${retryAttempt}.`);
        console.error(makeLogSafeRequestError(error));

        if ((error.status >= SERVER_ERROR_CODE && error.status <= NETWORK_AUTH_REQ_CODE) ||
            error.status === TOO_MANY_REQUESTS_CODE) {
            if (retryAttempt < MAX_RETRY_ATTEMPTS) {
                const backOffDelay = delay * BACKOFF_FACTOR;
                console.log(`Failed to resolve url ${url}. Attempt ${retryAttempt}. Received error status: ${
                    error.status}. Will retry after ${backOffDelay} ms.`);

                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        httpCallWithRetry(url, httpCall, retryAttempt + 1, backOffDelay)
                            .then(resolve)
                            .catch((error) => { reject(error); });
                    }, delay);
                });
            }
            else { throw error; }
        }
        else { throw error; }
    }
}

function getJsonFrom(url, authorization) {
    return httpCallWithRetry(url, async () => {
        const {body} = await get('get', url, authorization);
        /*
         handle the case when Martha receives empty JSON body. The reason behind forming a response with status 500
         and throwing it in `try` is so that it can be caught locally and be retried.
         */
        if (Object.keys(body).length === 0) {
            const errorMsg = `Received an empty JSON body while trying to resolve url '${url}'`;
            throw new FailureResponse(500, errorMsg);
        }
        else {
            return body;
        }
    });
}

function postJsonTo(url, authorization, payload, clientPrivateKey, clientCert) {
    return httpCallWithRetry(url, () => {
        const postReq = request.post(url, payload);
        if (clientPrivateKey) { postReq.key(clientPrivateKey); }
        if (clientCert) { postReq.cert(clientCert); }
        postReq.set('Content-Type', 'application/json');
        if (authorization) {
            postReq.set('authorization', authorization);
        }

        return postReq.then((response) => response.body);
    });
}

exports.get = get;
exports.getHeaders = getHeaders;
exports.getJsonFrom = getJsonFrom;
exports.postJsonTo = postJsonTo;
