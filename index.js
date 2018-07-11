/**
 * Google Cloud Function for GUID resolution
 * written by Ursa S 02/18
 */

const superagent = require('superagent');
const url = require('url')
const cors = require("cors");
const corsMiddleware = cors();
const config = require("./config.json")

function dosToHttps(dosUri) {
    var parsed_url = url.parse(dosUri);
    var orig_path = parsed_url.pathname;
    var new_path = '/ga4gh/dos/v1/dataobjects' + orig_path;

    // special case for hostless dos uris which will be better supported in martha v2
    if (parsed_url.host.startsWith("dg.")) {
        new_path = '/ga4gh/dos/v1/dataobjects/' + parsed_url.hostname + orig_path;
        parsed_url.host = config.dosResolutionHost;
    }

    console.log(new_path);
    parsed_url.protocol = 'https';
    parsed_url.path = new_path;
    parsed_url.pathname = new_path;
    console.log(parsed_url);
    console.log(parsed_url.toString);
    return url.format(parsed_url);
}

const martha_v1_handler = (req, res) => {
    var orig_url = req.body.url;
    var pattern = req.body.pattern;
    if(!orig_url) {
      orig_url = JSON.parse(req.body.toString()).url;
      pattern = JSON.parse(req.body.toString()).pattern;
    }

    var http_url = dosToHttps(orig_url)

    console.log(http_url);
    superagent.get(http_url)
        .end(function(err, response) {
            if(err){
                console.error(err);
                res.status(502).send(err);
                return;
            };
            try {
                var parsedData = JSON.parse(response.text);
            } catch(e) {
                // console.error(e);
                res.status(400).send(`Data returned not in correct format`);
                return;
            };
            var allData = parsedData["data_object"];
            if (!allData) {
                res.status(400).send(`No data received from ${req.body.url}`);
            } else {
                var urls = allData["urls"];
                if (!pattern) {
                    res.status(400).send(`No pattern param specified`);
                    return;
                }
                for (var url in urls) {
                    var currentUrl = urls[url]["url"];
                    if (currentUrl.startsWith(pattern)) {
                        var correctUrl = currentUrl;
                        res.status(200).send(correctUrl);
                    }
                }
                //gone through all urls, no match found
                if (!correctUrl) {
                    res.status(404).send(`No ${pattern} link found`);
                }
                ;
            }
            ;
        });
};

const martha_v2_handler = (req, res) => {
    var orig_url = req.body.url;
    if(!orig_url) {
        orig_url = JSON.parse(req.body.toString()).url;
    }

    var http_url = dosToHttps(orig_url);

    console.log(http_url);
    superagent.get(http_url)
        .end(function(err, response) {
            if(err) {
                console.error(err);
                res.status(502).send(err);
                return;
            }
            try {
                var parsedData = JSON.parse(response.text);
            } catch(e) {
                res.status(400).send(`Data returned not in correct format`);
                return;
            }
            superagent
                .get(`${config.bondBaseUrl}/api/link/v1/fence/serviceaccount/key`)
                .set('authorization', req.get("authorization"))
                .end(function(bondErr, bondResponse) {
                    if(bondErr) {
                        console.error(bondErr);
                        res.status(502).send(bondErr);
                        return;
                    }
                    try {
                        var parsedServiceAccountKey = JSON.parse(bondResponse.text);
                    } catch(e) {
                        res.status(500).send(`Service account key not in correct format`);
                        return;
                    }
                    res.status(200).send({'dos': parsedData, 'googleServiceAccount': parsedServiceAccountKey["data"]});
                });
        });
};

exports.martha_v1 = (req, res) => {
  corsMiddleware(req, res, () => martha_v1_handler(req, res));
};
exports.martha_v2 = (req, res) => {
    corsMiddleware(req, res, () => martha_v2_handler(req, res));
};

exports.dosToHttps = dosToHttps;