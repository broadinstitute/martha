const metadataApi = require('./metadata_api');
const saKeys = require('./service_account_keys');
const gcsUrlSigner = require('fileSummaryV1/gcsUrlSigner');
const url = require('url');

// This function counts on the request posing data as "application/json" content-type.
// See: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests for more details

const dataObjectProtocols = ['dos:', 'drs:'];
const gsProtocols = ['gs:'];

function isValidProtocol(urlString) {
    const validProtocols = dataObjectProtocols.concat(gsProtocols);
    try {
        return validProtocols.includes(url.parse(urlString).protocol);
    } catch (e) {
        console.error(new Error(`URI protocols must be one of [${validProtocols.join(', ')}]: ${urlString}`));
        return false;
    }
}

/**
 * Takes a uri for a Data Object or a GS object along with an authorization header.  This method will gather and return
 * metadata for the object and will attempt to use the bearer token to generate a signed url
 * (https://cloud.google.com/storage/docs/access-control/signed-urls) that will grant access to the object.
 * @param req
 * @param res
 */
async function fileSummaryV1Handler(req, res) {
    const origUrl = (req.body || {}).uri;
    const auth = req.headers.authorization;

    if (!origUrl || !isValidProtocol(origUrl)) {
        console.error(new Error('Uri is missing or invalid'));
        res.status(400).send('Request must specify the URI of a DOS or GS object');
        return;
    } else if (!auth) {
        console.error(new Error('Request did not not specify an authorization header'));
        res.status(401).send('Requests must contain a bearer token');
        return;
    }

    console.log('Input: ', origUrl);

    // URLs are either Data Object URLs or Google Bucket URLs
    const isDataObjectUrl = dataObjectProtocols.includes(url.parse(origUrl).protocol);
    try {

        const [serviceAccountKey, metadata] = await Promise.all([
            saKeys.getServiceAccountKey(origUrl, auth, isDataObjectUrl),
            metadataApi.getMetadata(origUrl, auth, isDataObjectUrl)
        ]);

        if (serviceAccountKey) {
            metadata.signedUrl = await gcsUrlSigner.createSignedGsUrl(serviceAccountKey, metadata);
        }

        res.status(200).send(metadata);

    } catch (err) {
        console.error(new Error('Failed to get Service Account Key and/or object metadata'));
        if (err instanceof Error) {
            console.error(err);
        } else {
            console.error(new Error(err));
        }
        res.status(502).send(err);
    }
}

exports.fileSummaryV1Handler = fileSummaryV1Handler;
