const helpers = require('./helpers');
const request = require('superagent');

function get_text_from(url, authorization = null) {
    const get_req = request.get(url);
    if (authorization != null) {
        get_req.set('authorization', authorization)
    }
    return get_req.then(function (response) {
            return response.text;
        });
}

function resolve_dos(dos_url) {
    return request.get(dos_url)
        .then(function (response) {
            try {
                return JSON.parse(response.text);
            } catch (e) {
                throw new Error('DOS response is not valid JSON\n' + e);
            }
        });
}

function talk_to_bond(authorization) {
    // return superagent.get(`${helpers.bondBaseUrl()}/api/link/v1/fence/serviceaccount/key`)
    return request.get(`${helpers.bondBaseUrl()}/api/status/v1/`)
        .set('authorization', authorization)
        .then(function (bondResponse) {
            try {
                return JSON.parse(bondResponse.text);
            } catch (e) {
                throw new Error('Bond response is not valid JSON\n' + e);
            }
        });
}

exports.resolve_dos = resolve_dos;
exports.talk_to_bond = talk_to_bond;
exports.get_text_from = get_text_from;