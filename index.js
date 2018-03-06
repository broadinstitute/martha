/**
 * Google Cloud Function for GUID resolution
 * written by Ursa S 02/18
 */

const superagent = require('superagent');

exports.martha_v1 = (req, res) => {
    superagent.get(req.body.url)
        .end(function(err, response) {
            if(err){
                console.error(err);
                res.status(400).send(err);
                return;
            };
            // console.log(response);
            try {
                var parsedData = JSON.parse(response.text);
            } catch(e) {
                // console.error(e);
                res.status(400).send(`Data returned not in correct format`);
                return;
            };
            var allData = parsedData["data_object"];
            if (!allData) {
                res.status(404).send(`No data received from ${req.body.url}`);
            } else if (req.body.pattern == 'all') {
                res.status(200).send(allData);
            } else {
                var urls = allData["urls"];
                var pattern = (req.body.pattern || 'gs://');
                for (var url in urls) {
                    var currentUrl = urls[url]["url"];
                    if (currentUrl.startsWith(pattern)) {
                        var correctUrl = currentUrl;
                        res.status(200).send(correctUrl);
                    }
                }
                //gone through all urls, no match found
                if (!correctUrl) {
                    res.status(417).send(`No ${pattern} link found`);
                }
                ;
            }
            ;
        });
};