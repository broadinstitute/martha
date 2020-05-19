const apiAdapter = require('../common/api_adapter');
const { promiseHandler, Response, samBaseUrl } = require('../common/helpers');
const { bondBaseUrl, BondProviders, determineBondProvider } = require('../common/bond');
const createSignedGsUrl = require('../common/createSignedGsUrl');

const getSignedUrlV1 = promiseHandler(async (req) => {
    const { bucket, object: name, dataObjectUri } = req.body || {};
    const auth = req.headers.authorization;
    const provider = dataObjectUri && determineBondProvider(dataObjectUri);
    try {
        const credentials = (provider && provider !== BondProviders.HCA) ?
            (await apiAdapter.getJsonFrom(`${bondBaseUrl()}/api/link/v1/${provider}/serviceaccount/key`, auth)).data :
            await apiAdapter.getJsonFrom(`${samBaseUrl()}/api/google/v1/user/petServiceAccount/key`, auth);
        const url = await createSignedGsUrl.createSignedGsUrl(credentials, {bucket, name});
        return new Response(200, { url });
    } catch (e) {
        throw provider && e.response ? new Response(e.status, JSON.parse(e.response.text).error) : e;
    }
});

module.exports = getSignedUrlV1;
