const {dataObjectUriToHttps, parseRequest} = require('../common/helpers');
const {maybeTalkToBond, determineBondProvider, BondProviders} = require('../common/bond');
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

function marthaV3Handler(req, res) {
    const dataObjectUri = parseRequest(req);
    const auth = req.headers.authorization;

    if (!dataObjectUri) {
        console.error(new Error('Request did not specify the URL of a DRS object'));
        res.status(400).send('Request must specify the URL of a DRS object');
        return;
    } else if (!auth) {
        console.error(new Error('Request did not not specify an authorization header'));
        res.status(400).send('Requests must contain a bearer token');
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

    console.log(`Bond provider for url '${dataObjectUri}' is '${bondProvider}'.`);

    let dataObjectPromise;

    if (bondProvider === BondProviders.JADE_DATA_REPO) {
        dataObjectPromise = apiAdapter.getJsonFrom(dataObjectResolutionUrl, auth);
    } else {
        dataObjectPromise = apiAdapter.getJsonFrom(dataObjectResolutionUrl);
    }


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

exports.marthaV3Handler = marthaV3Handler;
