const { dataObjectUriToHttps, parseRequest, convertToMarthaV3Response, FailureResponse } = require('../common/helpers');
const { maybeTalkToBond, determineBondProvider, BondProviders } = require('../common/bond');
const apiAdapter = require('../common/api_adapter');

const BAD_REQUEST_ERROR_CODE = 400;
const SERVER_ERROR_CODE = 500;


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
    return convertToMarthaV3Response(drsResponse, googleServiceAccount);
}

function marthaV3Handler(req, res) {
    const dataObjectUri = parseRequest(req);
    const auth = req.headers.authorization;

    try {
        validateRequest(dataObjectUri, auth);
    } catch (error) {
        console.error(error);
        const failureResponse = new FailureResponse(BAD_REQUEST_ERROR_CODE, `Request is invalid. ${error.message}`);
        res.status(BAD_REQUEST_ERROR_CODE).send(failureResponse);
        return;
    }

    // !!!!!!!!!!!!!!! REMOVE BEFORE MERGING !!!!!!!!!!!!!!!!
    console.log('Extra log message to check if Codacy ran on the PR. Remove this before merging')

    // !!!!!! MAKE SURE TO ADD SEMI-COLON BACK BEFORE MERGING
    console.log(`Received URL '${dataObjectUri}' from IP '${req.ip}'`)
    let dataObjectResolutionUrl;
    try {
        dataObjectResolutionUrl = dataObjectUriToHttps(dataObjectUri);
    } catch (err) {
        console.error(err);
        const failureResponse = new FailureResponse(BAD_REQUEST_ERROR_CODE, `The specified URL '${dataObjectUri}' is invalid`);
        res.status(BAD_REQUEST_ERROR_CODE).send(failureResponse);
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

            const errorStatusCode = err.status;
            if (typeof errorStatusCode === 'undefined') {
                const failureResponse = new FailureResponse(SERVER_ERROR_CODE, `Received error while resolving drs url. ${err.message}`);
                res.status(SERVER_ERROR_CODE).send(failureResponse);
            } else {
                res.status(errorStatusCode).send(err);
            }
        });
}

exports.marthaV3Handler = marthaV3Handler;
