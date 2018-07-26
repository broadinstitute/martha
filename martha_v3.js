const Storage = require('@google-cloud/storage');
const helpers = require('./helpers');
const apiAdapter = require('./api_adapter');

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

    const maybeTalkToBond = async () => {
        try {
            return (await apiAdapter.getJsonFrom(
                `${helpers.bondBaseUrl()}/api/link/v1/fence/serviceaccount/key`,
                auth
            )).data;
        } catch (e) {
            return undefined;
        }
    };

    const maybeTalkToSam = () => {
        return apiAdapter.getJsonFrom(
            `${helpers.samBaseUrl()}/api/google/v1/user/petServiceAccount/key`,
            auth
        );
    };

    const getDosObject = () => {
        const newUri = helpers.dosToHttps(origUrl);

        return apiAdapter.getJsonFrom(newUri);
    };

    const parseGsUri = (uri) => {
        return /gs:[/][/]([^/]+)[/](.+)/.exec(uri).slice(1);
    };

    const getGsObjectMetadata = async (gsUri) => {
        const token = await apiAdapter.postJsonTo(
            `${helpers.samBaseUrl()}/api/google/v1/user/petServiceAccount/token`,
            auth,
            '["https://www.googleapis.com/auth/devstorage.full_control"]'
        );

        const [bucket, name] = parseGsUri(gsUri);

        const response = await apiAdapter.getHeaders(
            `https://${bucket}.storage.googleapis.com/${encodeURIComponent(name)}`,
            `Bearer ${token}`
        );

        return {
            contentType: response['content-type'],
            size: parseInt(response['content-length']),
            // timeCreated: ,
            updated: response['last-modified'],
            md5Hash: response['x-goog-hash'].substring(response['x-goog-hash'].indexOf('md5=') + 4),
            bucket,
            name,
            uri: gsUri
        };
    };

    const getServiceAccountKey = () => isDos ? maybeTalkToBond() : maybeTalkToSam();

    const getMetadata = async () => {
        const uri = isDos ?
            (await getDosObject().catch(() => Promise.reject('Couldn\'t resolve DOS object')))
                .data_object.urls.find(e => e.url.startsWith('gs://')).url :
            origUrl;

        return getGsObjectMetadata(uri).catch(e => Promise.reject('Couldn\'t get metadata'));
    };

    try {
        const [serviceAccountKey, metadata] = await Promise.all([
            getServiceAccountKey().catch(e => {
                res.status(e.status).send('Error talking to SAM');
            }),
            getMetadata()
        ]);

        if (!serviceAccountKey && !isDos) {
            return;
        }

        const createSignedGsUrl = async () => {
            const storage = new Storage({ credentials: serviceAccountKey });

            return (await storage.bucket(metadata.bucket).file(metadata.name).getSignedUrl({
                action: 'read',
                expires: Date.now() + 36e5
            }))[0];
        };

        if (serviceAccountKey) {
            metadata.signedUrl = await createSignedGsUrl(serviceAccountKey, metadata);
        }

        res.status(200).send(metadata);
    } catch (e) {
        res.status(500).send('Error parsing URI');
    }
}

exports.martha_v3_handler = martha_v3_handler;
