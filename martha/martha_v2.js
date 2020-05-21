const { dataObjectUriToHttps, parseRequest } = require('../common/helpers');
const { maybeTalkToBond, determineBondProvider } = require('../common/bond');
const apiAdapter = require('../common/api_adapter');


function aggregateResponses(responses) {
    // Note: for backwards compatibility, we are returning the DRS object with the key, "dos".  If we want to change this, we can add a new api version for Martha_v2.
    // When/if we change this, we might want to consider replacing "dos" with "data_object" or something like that that is unlikely to change
    const finalResult = { dos: responses[0] };
    if (responses[1]) {
        finalResult.googleServiceAccount = responses[1];
    }

    return finalResult;
}

function marthaV2Handler(req, res) {
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
            console.log('Received error while either contacting Bond or resolving drs url.');
            console.error(err);
            res.status(502).send(err);
        });
}

exports.marthaV2Handler = marthaV2Handler;
