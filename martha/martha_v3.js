const {dataObjectUriToHttps, parseRequest} = require('../common/helpers');
const {bondBaseUrl, determineBondProvider, BondProviders} = require('../common/bond');
const apiAdapter = require('../common/api_adapter');


async function maybeTalkToBond(req, provider = BondProviders.default) {
    // Currently HCA data access does not require additional credentials.
    // The HCA checkout buckets allow object read access for GROUP_All_Users@firecloud.org.
    if (req && req.headers && req.headers.authorization && provider !== BondProviders.HCA) {
        try {
            return await apiAdapter.getJsonFrom(`${bondBaseUrl()}/api/link/v1/${provider}/serviceaccount/key`, req.headers.authorization);
        } catch (error) {
            console.log(`Received error while fetching service account from Bond for provider '${provider}'.`);
            console.error(error);
            throw error;
        }
    } else {
        return Promise.resolve();
    }
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

function marthaV3Handler(req, res) {
    const dataObjectUri = parseRequest(req);

    if (!dataObjectUri) {
        console.error(new Error('Request did not specify the URL of a DRS object'));
        res.status(400).send('Request must specify the URL of a DRS object');
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

exports.marthaV3Handler = marthaV3Handler;
