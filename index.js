/**
 * Google Cloud Function for GUID resolution
 * written by Ursa S 02/18
 */

const superagent = require('superagent');
const url = require('url')

exports.martha_v1 = (req, res) => {
    var orig_url = req.body.url;
    var pattern = req.body.pattern;
    if(!orig_url) {
      orig_url = JSON.parse(req.body.toString()).url;
      pattern = JSON.parse(req.body.toString()).pattern;
    }
    if(req.headers && req.headers.hasOwnProperty('origin')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', ["POST", "GET"]);
    }
    var parsed_url = url.parse(orig_url);
    var orig_path = parsed_url.pathname;
    var new_path = '/ga4gh/dos/v1/dataobjects' + orig_path;
    console.log(new_path);
    parsed_url.protocol = 'https';
    parsed_url.path = new_path;
    parsed_url.pathname = new_path;
    console.log(parsed_url);
    console.log(parsed_url.toString);
    var http_url = url.format(parsed_url);

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