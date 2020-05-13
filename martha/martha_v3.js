const {dataObjectUriToHttps, parseRequest, getFileInfoFromDrsResponse} = require('../common/helpers');
const {maybeTalkToBond, determineBondProvider, BondProviders} = require('../common/bond');
const apiAdapter = require('../common/api_adapter');


function validateRequest(dataObjectUri, auth) {
    if (!dataObjectUri) {
        throw new Error('URL of a DRS object is missing.');
    } else if (!auth) {
        throw new Error('Authorization header is missing.');
    }
}

function getDataObjectMetadata(dataObjectResolutionUrl, auth, bondProvider) {
    if (bondProvider === BondProviders.JADE_DATA_REPO) {
        return apiAdapter.getJsonFrom(dataObjectResolutionUrl, auth);
    } else {
        return apiAdapter.getJsonFrom(dataObjectResolutionUrl);
    }
}

function aggregateResponses(responses) {
    const drsResponse = responses[0];
    const googleServiceAccount = responses[1];
    return getFileInfoFromDrsResponse(drsResponse, googleServiceAccount);
}

function marthaV3Handler(req, res) {
    const dataObjectUri = parseRequest(req);
    const auth = req.headers.authorization;

    try {
        validateRequest(dataObjectUri, auth);
    } catch (error) {
        console.error(error);
        res.status(400).send(`Request is invalid. ${error.message}`);
        return;
    }

    console.log(`Received URL: ${dataObjectUri}`);
    let dataObjectResolutionUrl;
    try {
        dataObjectResolutionUrl = dataObjectUriToHttps(dataObjectUri);
    } catch (err) {
        console.error(err);
        res.status(400).send(`The specified URL '${dataObjectUri}' is invalid`);
        return;
    }

    const bondProvider = determineBondProvider(dataObjectUri);
    const dataObjectPromise = getDataObjectMetadata(dataObjectResolutionUrl, auth, bondProvider);
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
