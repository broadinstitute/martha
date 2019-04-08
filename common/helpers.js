const url = require('url');
const config = require('../config.json');
const URL = require('url');

function dataObjectUrlToHttps(dataObjectUrl) {
    const parsedUrl = url.parse(dataObjectUrl);

    if (!parsedUrl.protocol || !parsedUrl.host || !parsedUrl.pathname) {
        throw new Error(`Invalid URL: "${dataObjectUrl}"`);
    }

    parsedUrl.protocol = 'https';
    parsedUrl.host = config.dataObjectResolutionHost;
    parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects${parsedUrl.pathname}`;

    const output = url.format(parsedUrl);
    console.log(`${dataObjectUrl} -> ${output}`);
    return output;
}

const BondProviders = Object.freeze({
    FENCE: 'fence',
    DCF_FENCE: 'dcf-fence',
    get default() {
        return this.DCF_FENCE;
    }
});

function determineBondProvider(urlString) {
    const url = URL.parse(urlString);
    if (url.host === 'dg.4503') {
        return BondProviders.FENCE;
    } else {
        return BondProviders.default;
    }
}

const bondBaseUrl = () => config.bondBaseUrl;
const samBaseUrl = () => config.samBaseUrl;

module.exports = {dataObjectUrlToHttps: dataObjectUrlToHttps, bondBaseUrl, samBaseUrl, BondProviders, determineBondProvider};
