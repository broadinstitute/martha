const {dataObjectUriToHttps, bondBaseUrl, determineBondProvider, BondProviders} = require('../common/helpers');
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
    // Currently HCA data access does not require additional credentials.
    // The HCA checkout buckets allow object read access for GROUP_All_Users@firecloud.org.
    if (req && req.headers && req.headers.authorization && provider !== BondProviders.HCA) {
        myPromise = apiAdapter.getJsonFrom(`${bondBaseUrl()}/api/link/v1/${provider}/serviceaccount/key`, req.headers.authorization);
    } else {
        myPromise = Promise.resolve();
    }
    return myPromise;
}

function aggregateResponses(responses) {
    // Note: for backwards compatibility, we are returning the DRS object with the key, "dos".  If we want to change this, we can add a new api version for Martha_v2.
    // When/if we change this, we might want to consider replacing "dos" with "data_object" or something like that that is unlikely to change
    const finalResult = { dos: responses[0] };
    if (responses[1]) {
        finalResult.googleServiceAccount = responses[1];
    }

    return finalResult;
}

function martha_v2_handler(req, res) {
    const dataObjectUri = parseRequest(req);
    if (!dataObjectUri) {
        res.status(400).send('Request must specify the URL of a DOS object');
        return;
    }

    console.log(`Received URL: ${dataObjectUri}`);
    let dataObjectResolutionUrl;
    try {
        dataObjectResolutionUrl = dataObjectUriToHttps(dataObjectUri);
    } catch (err) {
        console.error(err);
        res.status(400).send('The specified URL is invalid');
        return;
    }

    const bondProvider = determineBondProvider(dataObjectUri);

    const dataObjectPromise = apiAdapter.getJsonFrom(dataObjectResolutionUrl);
    const bondPromise = maybeTalkToBond(req, bondProvider);

    return Promise.all([dataObjectPromise, bondPromise])
        .then((rawResults) => {
            res.status(200).send(aggregateResponses(rawResults));
        })
        .catch((err) => {
            console.error(err);
            res.status(502).send(err);
        });
}

exports.martha_v2_handler = martha_v2_handler;
