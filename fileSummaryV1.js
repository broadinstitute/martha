const metadataApi = require('./metadata_api');
const saKeys = require('./service_account_keys');
const urlSigner = require('./urlSigner');
const url = require('url');

// This function counts on the request posing data as "application/json" content-type.
// See: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests for more details

function isValidProtocol(urlString) {
    try {
        return ["gs:", "dos:"].indexOf(url.parse(urlString).protocol) >= 0;
    } catch(e) {
        console.error(`URI must use 'gs:' or 'dos:' protocols: ${urlString}`);
        return false;
    }
}

/**
 * Takes a uri for a DOS object or a GS object along with an authorization header.  This method will gather and return
 * metadata for the object and will attempt to use the bearer token to generate a signed url
 * (https://cloud.google.com/storage/docs/access-control/signed-urls) that will grant access to the object.
 * @param req
 * @param res
 * @returns {Promise<any[]>}
 */
function fileSummaryV1Handler(req, res) {
    const origUrl = (req.body || {}).uri;
    const auth = req.headers.authorization;

    if (!origUrl || !isValidProtocol(origUrl)) {
        console.error('Uri is missing or invalid');
        res.status(400).send('Request must specify the URI of a DOS or GS object');
        return;
    } else if (!auth) {
        console.error('Request did not not specify an authorization header');
        res.status(401).send('Requests must contain a bearer token');
        return;
    }

    console.log('Input: ', origUrl);

    const isDos = origUrl.startsWith('dos://');

    return Promise.all([
        saKeys.getServiceAccountKey(auth, isDos),
        metadataApi.getMetadata(origUrl, auth, isDos)
    ]).then(async (results) => {
        const [serviceAccountKey, metadata] = results;

        if (serviceAccountKey) {
            metadata.signedUrl = await urlSigner.createSignedGsUrl(serviceAccountKey, metadata);
        }

        res.status(200).send(metadata);
    }).catch((err) => {
        // TODO - pretty print the error to logs like what gets sent in the response
        console.error("Failed to get Service Account Key and/or object metadata");
        res.status(502).send(err);
    });
}

exports.fileSummaryV1Handler = fileSummaryV1Handler;
