const metadataApi = require('./metadata_api');
const saKeys = require('./service_account_keys');
const urlSigner = require('./urlSigner');

// This function counts on the request posing data as "application/json" content-type.
// See: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests for more details

async function martha_v3_handler(req, res) {
    const origUrl = (req.body || {}).uri;
    const auth = req.headers.authorization;

    if (!origUrl) {
        res.status(400).send('Request must specify the URI of a DOS or GS object');
        return;
    } else if (!auth) {
        res.status(401).send('Requests must contain a bearer token');
        return;
    }

    console.log('Input: ', origUrl);

    const isDos = origUrl.startsWith('dos://');

    return await Promise.all([
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

exports.martha_v3_handler = martha_v3_handler;
