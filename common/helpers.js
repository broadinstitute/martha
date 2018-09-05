const url = require('url');
const config = require('../config.json');

function dosToHttps(dosUri) {
    const parsedUrl = url.parse(dosUri);

    if (!parsedUrl.protocol || !parsedUrl.host || !parsedUrl.pathname) {
        throw new Error(`Invalid URL: "${dosUri}"`)
    }

    parsedUrl.protocol = 'https';
    parsedUrl.host = config.dosResolutionHost;
    parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects${parsedUrl.pathname}`;

    const output = url.format(parsedUrl);
    console.log(`${dosUri} -> ${output}`);
    return output;
}

const bondBaseUrl = () => config.bondBaseUrl;
const samBaseUrl = () => config.samBaseUrl;

exports.dosToHttps = dosToHttps;
exports.bondBaseUrl = bondBaseUrl;
exports.samBaseUrl = samBaseUrl;
