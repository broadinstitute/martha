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

exports.get_text_from = get_text_from;