const url = require('url');
const config = require('../config.json');
const URL = require('url');

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

module.exports = {dosToHttps, bondBaseUrl, samBaseUrl, BondProviders, determineBondProvider};
