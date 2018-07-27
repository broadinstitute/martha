const helpers = require('./helpers');
const apiAdapter = require('./api_adapter');

async function getMetadata(url, auth, isDos) {
    try {
        const uri = isDos ?
            getGsUriFromDos((await getDosObject(url)).data_object) :
            url;

        return getGsObjectMetadata(uri, auth);
    } catch (e) {
        console.error('Metadata problems:', e);
    }
}

function getRawMetadata(token, bucket, name) {
    return apiAdapter.getHeaders(
        `https://${bucket}.storage.googleapis.com/${encodeURIComponent(name)}`,
        `Bearer ${token}`
    ).catch((e) => {
        switch (e.status) {
            case 403:
                console.error("Permission denied for bucket object");
                break;
            default:
                console.error("Unexpected error while trying to get headers for bucket object")
        }
        throw e;
    });
}

function getPetTokenFromSam(bearerToken) {
    return apiAdapter.postJsonTo(
        `${helpers.samBaseUrl()}/api/google/v1/user/petServiceAccount/token`,
        bearerToken,
        '["https://www.googleapis.com/auth/devstorage.full_control"]')
        .catch((e) => {
            console.error("Failed to get Pet Service Account Token from Sam");
            throw e;
        });
}

function getGsObjectMetadata(gsUri, auth) {
    const [bucket, name] = parseGsUri(gsUri);

    return getPetTokenFromSam(auth)
    .then((token) => getRawMetadata(token, bucket, name))
    .then((response) => {
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
    })
    .catch((e) => {
        console.error(`Failed to get metadata for: ${gsUri}`);
        throw e;
    });
}

function parseGsUri(uri) {
    return /gs:[/][/]([^/]+)[/](.+)/.exec(uri).slice(1);
}

function getGsUriFromDos(dosMetadata) {
    return dosMetadata.urls.find(e => e.url.startsWith('gs://')).url;
}

function getDosObject(dosUri) {
    const newUri = helpers.dosToHttps(dosUri);

    return apiAdapter.getJsonFrom(newUri).catch((e) => console.error("Failed while trying to retrieve DOS object", e));
}

exports.getMetadata = getMetadata;