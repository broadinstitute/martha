const {dosToHttps, bondBaseUrl, determineBondProvider, BondProviders} = require('../common/helpers');
const apiAdapter = require('../common/api_adapter');

// This function counts on the request posing  data as "application/json" content-type.
// See: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests for more details
function parseRequest(req) {
    if (req && req.body) {
        return req.body.url;
    }
}

function maybeTalkToBond(req, provider = BondProviders.default) {
    let myPromise;
    if (req && req.headers && req.headers.authorization) {
        myPromise = apiAdapter.getJsonFrom(`${bondBaseUrl()}/api/link/v1/${provider}/serviceaccount/key`, req.headers.authorization);
    } else {
        myPromise = Promise.resolve();
    }
    return myPromise;
}

function aggregateResponses(responses) {
    const finalResult = { dos: responses[0] };
    if (responses[1]) {
        finalResult.googleServiceAccount = responses[1];
    }

    return finalResult;
}

function martha_v2_handler(req, res) {
    const origUrl = parseRequest(req);
    if (!origUrl) {
        res.status(400).send('Request must specify the URL of a DOS object');
        return;
    }

    console.log(`Received URL: ${origUrl}`);
    let dosUrl;
    try {
        dosUrl = dosToHttps(origUrl);
    } catch (e) {
        console.error(new Error(e));
        res.status(400).send('The specified URL is invalid');
        return;
    }

    const bondProvider = determineBondProvider(origUrl);

    const dosPromise = apiAdapter.getJsonFrom(dosUrl);
    const bondPromise = maybeTalkToBond(req, bondProvider);

    return Promise.all([dosPromise, bondPromise])
        .then((rawResults) => {
            res.status(200).send(aggregateResponses(rawResults));
        })
        .catch((err) => {
            console.error(new Error(err));
            res.status(502).send(err);
        });
}

exports.martha_v2_handler = martha_v2_handler;
