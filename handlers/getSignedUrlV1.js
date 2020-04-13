const {Storage} = require('@google-cloud/storage');
const apiAdapter = require('../common/api_adapter');
const {promiseHandler, Response, samBaseUrl} = require('../common/helpers');
const {bondBaseUrl, determineBondProvider, BondProviders} = require('../common/bond');

const getSignedUrlV1 = promiseHandler(async (req) => {
    const { bucket, object, dataObjectUri } = req.body || {};
    const auth = req.headers.authorization;
    const provider = dataObjectUri && determineBondProvider(dataObjectUri);
    try {
        const credentials = (provider && provider !== BondProviders.HCA) ?
            (await apiAdapter.getJsonFrom(`${bondBaseUrl()}/api/link/v1/${provider}/serviceaccount/key`, auth)).data :
            await apiAdapter.getJsonFrom(`${samBaseUrl()}/api/google/v1/user/petServiceAccount/key`, auth);
        const storage = new Storage({ credentials });
        const [url] = await storage.bucket(bucket).file(object).getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 36e5
        });
        return new Response(200, { url });
    } catch (e) {
        throw provider && e.response ? new Response(e.status, JSON.parse(e.response.text).error) : e;
    }
});

module.exports = getSignedUrlV1;
