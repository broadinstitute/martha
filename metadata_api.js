const helpers = require('./helpers');
const apiAdapter = require('./api_adapter');

function getRawMetadata(token, bucket, name) {
    return apiAdapter.getHeaders(
        `https://${bucket}.storage.googleapis.com/${encodeURIComponent(name)}`,
        `Bearer ${token}`
    ).catch((e) => {
        console.error(new Error(e.status === 403 ?
            'Permission denied for bucket object' :
            'Unexpected error while trying to get headers for bucket object'
        ));
        throw e;
    });
}

function getPetTokenFromSam(bearerToken) {
    return apiAdapter.postJsonTo(
        `${helpers.samBaseUrl()}/api/google/v1/user/petServiceAccount/token`,
        bearerToken,
        '["https://www.googleapis.com/auth/devstorage.full_control"]')
        .catch((e) => {
            console.error(new Error('Failed to get Pet Service Account Token from Sam'));
            throw e;
        });
}

function parseGsUri(uri) {
    return /gs:[/][/]([^/]+)[/](.+)/.exec(uri).slice(1);
}

function getGsObjectMetadata(gsUri, auth) {
    const [bucket, name] = parseGsUri(gsUri);

    return getPetTokenFromSam(auth)
        .then((token) => getRawMetadata(token, bucket, name))
        .then((response) => {
            const {
                'content-type': contentType, 'content-length': contentLength,
                'last-modified': lastModified, 'x-goog-hash': xGoogHash
            } = response;

            return {
                contentType,
                size: parseInt(contentLength),
                updated: new Date(lastModified).toString(),
                md5Hash: xGoogHash.substring(xGoogHash.indexOf('md5=') + 4),
                bucket,
                name,
                gsUri
            };
        })
        .catch((e) => {
            console.error(new Error(`Failed to get metadata for: ${gsUri}`));
            throw e;
        });
}

function getGsUriFromDos(dosMetadata) {
    return dosMetadata.urls.find((e) => e.url.startsWith('gs://')).url;
}

function getDosObjectMetadata(dosUri) {
    const newUri = helpers.dosToHttps(dosUri);

    return apiAdapter.getJsonFrom(newUri)
        .then((response) => response.data_object)
        .then((metadata) => {
            const { mime_type, size, created, updated, checksums } = metadata;
            const gsUri = getGsUriFromDos(metadata);
            const [bucket, name] = parseGsUri(gsUri);

            return {
                contentType: mime_type || 'application/octet-stream',
                size,
                timeCreated: created ? new Date(created).toString() : undefined,
                updated: updated ? new Date(updated).toString() : undefined,
                md5Hash: (checksums.find((e) => e.type === 'md5') || {}).checksum,
                bucket,
                name,
                gsUri
            };
        })
        .catch((e) => {
            console.error(new Error(`Failed to get metadata for: ${dosUri} -> ${newUri}`));
            throw e;
        });
}

async function getMetadata(url, auth, isDos) {
    try {
        return isDos ? getDosObjectMetadata(url) : getGsObjectMetadata(url, auth);
    } catch (e) {
        console.error(new Error('Metadata problems:'), e);
    }
}

exports.getMetadata = getMetadata;
