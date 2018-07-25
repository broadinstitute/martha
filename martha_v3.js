const Storage = require('@google-cloud/storage');
const helpers = require('./helpers');
const apiAdapter = require('./api_adapter');

// This function counts on the request posing data as "application/json" content-type.
// See: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests for more details

function maybeTalkToBond(auth) {
    return apiAdapter.getJsonFrom(`${helpers.bondBaseUrl()}/api/link/v1/fence/serviceaccount/key`, auth).catch(e => Promise.resolve());
}

function maybeTalkToSam(auth) {
    return apiAdapter.getJsonFrom(`${helpers.samBaseUrl()}/api/google/v1/user/petServiceAccount/key`, auth);
}

function getDosObject(dosUri) {
    const newUri = helpers.dosToHttps(dosUri);

    return apiAdapter.getJsonFrom(newUri);
}

function parseGsUri(uri) {
    return /gs:[/][/]([^/]+)[/](.+)/.exec(uri).slice(1);
}

async function getGsObjectMetadata(gsUri, auth) {
    const token = await apiAdapter.postJsonTo(`${helpers.samBaseUrl()}/api/google/v1/user/petServiceAccount/token`, auth, '["https://www.googleapis.com/auth/devstorage.full_control"]');
    const [bucket, name] = parseGsUri(gsUri);

    const response = await apiAdapter.getHeaders('head', `https://${bucket}.storage.googleapis.com/${encodeURIComponent(name)}`, `Bearer ${token}`);

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
}

async function getServiceAccountKey(auth, isDos) {
    try {
        if (isDos) {
            return (await maybeTalkToBond(auth)).data;
        } else {
            return maybeTalkToSam(auth);
        }
    } catch (e) {
        console.error('Key problems:', e);
    }
}

function getGsUriFromDos(dosMetadata) {
    return dosMetadata.urls.find(e => e.url.startsWith('gs://')).url;
}

async function getMetadata(url, auth, isDos) {
    try {
        const uri = isDos ? getGsUriFromDos((await getDosObject(url)).data_object) : url;

        return getGsObjectMetadata(uri, auth);
    } catch (e) {
        console.error('Metadata problems:', e);
    }
}

async function createSignedGsUrl(serviceAccountKey, { bucket, name }) {
    const storage = new Storage({ credentials: serviceAccountKey });

    return (await storage.bucket(bucket).file(name).getSignedUrl({ action: 'read', expires: Date.now() + 36e5 }))[0];
}

async function martha_v3_handler(req, res) {
    const origUrl = req.body.uri;
    const auth = req.headers.authorization;

    if (!origUrl) {
        res.status(400).send('Request must specify the URI of a DOS or GS object');
        return;
    } else if (!auth) {
        res.status(401).send('Request must contain a bearer token');
        return;
    }

    console.log('Input: ', origUrl);

    const isDos = origUrl.startsWith('dos://');

    const [serviceAccountKey, metadata] = await Promise.all([
        await getServiceAccountKey(auth, isDos),
        await getMetadata(origUrl, auth, isDos)
    ]);

    if (serviceAccountKey) {
        metadata.signedUrl = await createSignedGsUrl(serviceAccountKey, metadata);
    }

    res.status(200).send(metadata);
}

exports.martha_v3_handler = martha_v3_handler;
