const { dataObjectUriToHttps, Response, promiseHandler } = require('../common/helpers');

const resolveDataObjectUriV1 = promiseHandler(async (req) => {
    const { uri } = req.body || {};
    return new Response(200, { url: dataObjectUriToHttps(uri) });
});

module.exports = resolveDataObjectUriV1;
