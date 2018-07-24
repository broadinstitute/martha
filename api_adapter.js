const request = require('superagent');

function getHeaders(method, url, authorization) {
    const req = request[method](url);
    if (authorization) {
        req.set('authorization', authorization);
    }

    return req.then((response) => response.headers);
}

function getJsonFrom(url, authorization) {
    const getReq = request.get(url);
    if (authorization) {
        getReq.set('authorization', authorization);
    }
    return getReq.then((response) => response.body);
}

function postJsonTo(url, authorization, payload) {
    const postReq = request.post(url, payload);
    postReq.set('Content-Type', 'application/json');
    if (authorization) {
        postReq.set('authorization', authorization);
    }

    return postReq.then((response) => response.body);
}

exports.getHeaders = getHeaders;
exports.getJsonFrom = getJsonFrom;
exports.postJsonTo = postJsonTo;
