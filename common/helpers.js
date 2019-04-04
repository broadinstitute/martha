const url = require('url');
const config = require('../config.json');
const URL = require('url');

function drsToHttps(drsUri) {
    const parsedUrl = url.parse(drsUri);

    if (!parsedUrl.protocol || !parsedUrl.host || !parsedUrl.pathname) {
        throw new Error(`Invalid URL: "${drsUri}"`);
    }

    parsedUrl.protocol = 'https';
    parsedUrl.host = config.drsResolutionHost;
    // NOTE: dataguids.org currently still uses "dos" in their path as shown below.  Don't be surprised if this changes to "drs" at some point
    parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects${parsedUrl.pathname}`;

    const output = url.format(parsedUrl);
    console.log(`${drsUri} -> ${output}`);
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

module.exports = {drsToHttps, bondBaseUrl, samBaseUrl, BondProviders, determineBondProvider};
