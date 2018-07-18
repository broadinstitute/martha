const request = require("superagent");

function getTextFrom(url, authorization = null) {
    const getReq = request.get(url);
    if (authorization != null) {
        getReq.set("authorization", authorization);
    }
    return getReq.then(function (response) {
            return response.text;
        });
}

exports.getTextFrom = getTextFrom;