const { dataObjectUriToHttps, Response, promiseHandler } = require('../common/helpers');

const resolveDataObjectUri = promiseHandler(async (req) => {
    const { uri } = req.body || {};
    return new Response(200, { url: dataObjectUriToHttps(uri) });
});

module.exports = resolveDataObjectUri;
