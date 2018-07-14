const superagent = require('superagent');
const helpers = require('./helpers');

const martha_v1_handler = (req, res) => {
    var orig_url = req.body.url;
    var pattern = req.body.pattern;
    if (!orig_url) {
        orig_url = JSON.parse(req.body.toString()).url;
        pattern = JSON.parse(req.body.toString()).pattern;
    }

    var http_url = helpers.dosToHttps(orig_url);

    console.log(http_url);
    superagent.get(http_url)
        .then(function (response) {
            try {
                var parsedData = JSON.parse(response.text);
            } catch (e) {
                console.error(e);
                res.status(400).send(`Data returned not in correct format`);
                return;
            }
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
            }
        })
        .catch(function(err) {
            // TODO: this error condition has never been tested, write a test for it
            console.error(err);
            res.status(502).send(err);
        });
};

exports.martha_v1_handler = martha_v1_handler;