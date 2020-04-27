const { Storage } = require('@google-cloud/storage');

async function createSignedGsUrl(serviceAccountKey, { bucket, name }) {
    const storage = new Storage({ credentials: serviceAccountKey });

    return (await storage.bucket(bucket).file(name).getSignedUrl({ action: 'read', expires: Date.now() + 36e5 }))[0];
}

exports.createSignedGsUrl = createSignedGsUrl;
