const request = require('superagent');

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
        return error;
    }
}

async function getJsonFrom(url, authorization) {
    try {
        const {body} = await get('get', url, authorization);
        return body;
    } catch (error) {
        console.error(error);
        return error;
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
