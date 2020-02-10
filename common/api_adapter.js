const request = require('superagent');

const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_BACKOFF_DELAY = 1000;
const BACKOFF_FACTOR = 2;

function get(method, url, authorization) {
    const req = request[method](url);
    if (authorization) {
        req.set('authorization', authorization);
    }

    return req;
}

async function getHeaders(url, authorization) {
    try {
        const {headers} = await get('head', url, authorization);
        return headers;
    } catch (error) {
        console.error(error);
        // TODO: capture error here in order to give a more detailed idea of
        //  what went wrong where (see https://broadworkbench.atlassian.net/browse/WA-13)
        throw error;
    }
}

async function getJsonFrom(url, authorization, retryAttempt = 1, delay = INITIAL_BACKOFF_DELAY) {
    try {
        const {body} = await get('get', url, authorization);
        return body;
    } catch (error) {
        console.error(error);
        // TODO: capture error here in order to give a more detailed idea of
        //  what went wrong where (see https://broadworkbench.atlassian.net/browse/WA-13)

        if((error.status >= 500 && error.status <= 510) || error.status === 429) {
            if (retryAttempt < MAX_RETRY_ATTEMPTS) {
                let backOffDelay = delay * BACKOFF_FACTOR;
                console.log("Failed to resolve url '" + url + "'. Attempt " + retryAttempt + ". Received error status: " + error.status +
                    ". Will retry after " + backOffDelay + " ms.");

                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        getJsonFrom(url, authorization, retryAttempt + 1, backOffDelay)
                            .then(resolve)
                            .catch(error => reject(error));
                    }, delay);
                });
            }
            else throw error;
        } else throw error;
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
