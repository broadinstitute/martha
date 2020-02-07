const request = require('superagent');

const MAX_RETRY_ATTEMPTS = 3;

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

async function getJsonFrom(url, authorization, retryAttempt = 1, delay = 500) {
    try {
        const {body} = await get('get', url, authorization);

        console.log(
            "############ INFO ###############" + "\n" +
            "success!! Attempt- " + retryAttempt, " had to wait for " + delay, " before executing" + "\n" +
            "#################################"
        );

        return body;
    } catch (error) {
        console.error(error);
        // TODO: capture error here in order to give a more detailed idea of
        //  what went wrong where (see https://broadworkbench.atlassian.net/browse/WA-13)

        console.log(
            "*******************************" + "\n" +
            "FOUND ERROR !!!" + "\n" +
            "url- " + url + ", authorization- " + authorization, ", attempt- ", retryAttempt + "\n" +
            "status: " + error.status + "\n" +
            "*******************************" + "\n"
        );
        console.log(error);

        if((error.status >= 500 && error.status <= 510) || error.status === 429) {
        // if(error.status === 404) {
            if (retryAttempt < MAX_RETRY_ATTEMPTS) {
                console.log(
                    "YO YO YO YO YO YO YO YO YO YO YO YO YO YO YO " + "\n" +
                    "Received error status:", error.status, ". Will retry after ", delay * 2 + "\n" +
                    "YO YO YO YO YO YO YO YO YO YO YO YO YO YO YO "
                );

                // const pause = (duration) => new Promise(res => setTimeout(res, duration));
                // pause(delay).then(() => getJsonFrom(url, authorization, retryAttempt + 1, delay * 2));


                return new Promise(resolve => {
                    setTimeout(() => {
                        getJsonFrom(url, authorization, retryAttempt + 1, delay * 2)
                            .then(resolve);
                    }, delay);
                });
            }
            else throw error;
        } else {
            throw error;
        }
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
