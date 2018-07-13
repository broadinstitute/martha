const superagent = require('superagent');
const helpers = require('./helpers');

const martha_v2_handler = (req, res) => {
    var orig_url = req.body.url;
    if (!orig_url) {
        orig_url = JSON.parse(req.body.toString()).url;
    }

    var http_url = helpers.dosToHttps(orig_url);

    console.log(http_url);
    superagent.get(http_url)
        .end(function (err, response) {
            if (err) {
                console.error(err);
                res.status(502).send(err);
                return;
            }
            try {
                var parsedData = JSON.parse(response.text);
            } catch (e) {
                res.status(400).send(`Data returned not in correct format`);
                return;
            }
            superagent
                .get(`${config.bondBaseUrl}/api/link/v1/fence/serviceaccount/key`)
                .set('authorization', req.get("authorization"))
                .end(function (bondErr, bondResponse) {
                    if (bondErr) {
                        console.error(bondErr);
                        res.status(502).send(bondErr);
                        return;
                    }
                    try {
                        var parsedServiceAccountKey = JSON.parse(bondResponse.text);
                    } catch (e) {
                        res.status(500).send(`Service account key not in correct format`);
                        return;
                    }
                    res.status(200).send({'dos': parsedData, 'googleServiceAccount': parsedServiceAccountKey["data"]});
                });
        });
};

exports.martha_v2_handler = martha_v2_handler;