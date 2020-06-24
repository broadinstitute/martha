const { Storage } = require('@google-cloud/storage');

/*
 * NOTE: If you're wondering why this is its own module, that's because Sinon (testing library) can only modify
 * (and therefore stub) properties of an object import (because of how const works), not using destructuring.
 * To avoid the possibility of inadvertently stubbing something that shouldn't be, this function is all by itself.
 */

async function createSignedGsUrl(serviceAccountKey, {bucket, name}) {
    const storage = new Storage({ credentials: serviceAccountKey });
    const response = await storage.bucket(bucket).file(name).getSignedUrl({ action: 'read', expires: Date.now() + 36e5 });
    return response[0];
}

exports.createSignedGsUrl = createSignedGsUrl;
