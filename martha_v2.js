const helpers = require("./helpers");
const api_adapter = require("./api_adapter");

function parse_request(req) {
    let origUrl = req.body.url;
    if (!origUrl) {
        try {
            origUrl = JSON.parse(req.body.toString()).url;
        } catch (e) {
            console.error(new Error(`Request did not specify a valid url:\n${JSON.stringify(req)}\n${e}`));
        }
    }
    return origUrl;
}

function martha_v2_handler(req, res) {
    let origUrl = parse_request(req);
    if (!origUrl) {
        res.status(400).send("You must specify the URL of a DOS object");
        return;
    }

    let dosUrl;
    try {
        dosUrl = helpers.dosToHttps(origUrl);
    } catch (e) {
        console.error(e);
        res.status(400).send("The specified URL is invalid");
        return;
    }

    console.log(dosUrl);

    let dosPromise = api_adapter.getTextFrom(dosUrl);
    let bondPromise = api_adapter.getTextFrom(`${helpers.bondBaseUrl()}/api/link/v1/fence/serviceaccount/key`, req.headers.authorization);

    return Promise.all([dosPromise, bondPromise])
        .then((raw_results) => {
            const parsed_results = raw_results.map((str) => JSON.parse(str));
            res.status(200).send({dos: parsed_results[0], googleServiceAccount: parsed_results[1]});
        })
        .catch((err) => {
           console.error(err);
           res.status(502).send(err);
        });
}

exports.martha_v2_handler = martha_v2_handler;