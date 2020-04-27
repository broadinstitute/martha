const {dataObjectUriToHttps, convertToFileInfoResponse, samBaseUrl} = require('../common/helpers');
const apiAdapter = require('../common/api_adapter');

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
        `${samBaseUrl()}/api/google/v1/user/petServiceAccount/token`,
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

            return convertToFileInfoResponse (
                contentType,
                parseInt(contentLength),
                new Date(lastModified).toString(),
                null,
                xGoogHash.substring(xGoogHash.indexOf('md5=') + 4),
                bucket,
                name,
                gsUri,
                null
          );
        })
        .catch((e) => {
            console.error(new Error(`Failed to get metadata for: ${gsUri}`));
            throw e;
        });
}

function getGsUriFromDataObject(dataObjectMetadata) {
    return dataObjectMetadata.urls.find((e) => e.url.startsWith('gs://')).url;
}

function getDataObjectMetadata(dataObjectUri) {
    const newUri = dataObjectUriToHttps(dataObjectUri);

    return apiAdapter.getJsonFrom(newUri)
        .then((response) => response.data_object)
        .then((metadata) => {
            const { mimeType, size, created, updated, checksums } = metadata;
            const gsUri = getGsUriFromDataObject(metadata);
            const [bucket, name] = parseGsUri(gsUri);

            return convertToFileInfoResponse(
                mimeType || 'application/octet-stream',
                size,
                created ? new Date(created).toString() : null,
                updated ? new Date(updated).toString() : null,
                (checksums.find((e) => e.type === 'md5') || {}).checksum,
                bucket,
                name,
                gsUri,
                null
            );
        })
        .catch((e) => {
            console.error(new Error(`Failed to get metadata for: ${dataObjectUri} -> ${newUri}`));
            throw e;
        });
}

async function getMetadata(url, auth, isDataObjectUrl) {
    try {
        return isDataObjectUrl ? getDataObjectMetadata(url) : getGsObjectMetadata(url, auth);
    } catch (e) {
        console.error(new Error('Metadata problems:'), e);
    }
}

exports.getMetadata = getMetadata;
