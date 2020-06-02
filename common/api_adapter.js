const request = require('superagent');
const { FailureResponse } = require('../common/helpers');

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

    console.log('Making Request: ' + JSON.stringify(req));
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

async function getJsonFrom(url, authorization, retryAttempt = 1, delay = INITIAL_BACKOFF_DELAY) {
    try {
        const {body} = await get('get', url, authorization);

        /*
         handle the case when Martha receives empty JSON body. The reason behind forming a response with status 500
         and throwing it in `try` is so that it can be caught locally and be retried.
         */
        if (Object.keys(body).length === 0) {
            console.log(`Received an empty JSON body while trying to resolve url '${url}'. Attempt ${retryAttempt}. ` +
                'Creating a response with status 500.');

            const errorMsg = `Something went wrong while trying to resolve url '${url}'. It came back with empty JSON body!`;
            throw new FailureResponse(500, errorMsg);
        }
        else {
            console.log(`Successfully received response from url '${url}'.`);
            return body;
        }
    } catch (error) {
        console.log(`Received error for url '${url}'. Attempt ${retryAttempt}.`);
        console.error(error);

        if((error.status >= SERVER_ERROR_CODE && error.status <= NETWORK_AUTH_REQ_CODE) ||
            error.status === TOO_MANY_REQUESTS_CODE) {
            if (retryAttempt < MAX_RETRY_ATTEMPTS) {
                let backOffDelay = delay * BACKOFF_FACTOR;
                console.log('Failed to resolve url ' + url + '. Attempt ' + retryAttempt + '. Received error status: '
                    + error.status + '. Will retry after ' + backOffDelay + ' ms.');

                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        getJsonFrom(url, authorization, retryAttempt + 1, backOffDelay)
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

function postJsonTo(url, authorization, payload) {
    const postReq = request.post(url, payload);
    postReq.set('Content-Type', 'application/json');
    if (authorization) {
        postReq.set('authorization', authorization);
    }

    return postReq.then((response) => response.body);
}

exports.get = get;
exports.getHeaders = getHeaders;
exports.getJsonFrom = getJsonFrom;
exports.postJsonTo = postJsonTo;
