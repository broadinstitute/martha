const superagent = require('superagent');
const { dosToHttps } = require('./helpers');

const martha_v1_handler = (req, res) => {
    let orig_url = req.body.url;
    let pattern = req.body.pattern;
    if (!orig_url) {
        orig_url = JSON.parse(req.body.toString()).url;
        pattern = JSON.parse(req.body.toString()).pattern;
    }

    const http_url = dosToHttps(orig_url);

    console.log(http_url);
    superagent.get(http_url)
        .then(function (response) {
            let correctUrl;
            let parsedData;

            try {
                parsedData = JSON.parse(response.text);
            } catch (e) {
                console.error(e);
                res.status(400).send('Data returned not in correct format');
                return;
            }
            const allData = parsedData['data_object'];
            if (!allData) {
                res.status(400).send(`No data received from ${req.body.url}`);
            } else {
                const urls = allData['urls'];
                if (!pattern) {
                    res.status(400).send('No pattern param specified');
                    return;
                }
                for (const url of urls) {
                    const currentUrl = url.url;
                    if (currentUrl.startsWith(pattern)) {
                        correctUrl = currentUrl;
                        res.status(200).send(currentUrl);
                    }
                }
                //gone through all urls, no match found
                if (!correctUrl) {
                    res.status(404).send(`No ${pattern} link found`);
                }
            }
        })
        .catch(function (err) {
            // TODO: this error condition has never been tested, write a test for it
            console.error(err);
            res.status(502).send(err);
        });
};

exports.martha_v1_handler = martha_v1_handler;
