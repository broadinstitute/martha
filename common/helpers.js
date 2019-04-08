const url = require('url');
const config = require('../config.json');
const URL = require('url');

function dataObjectUrlToHttps(dataObjectUrl) {
    const parsedUrl = url.parse(dataObjectUrl);

    parsedUrl.protocol = 'https';

    // 3 Scenarios we need to account for:
    //      1. host part starts with "dg."
    //      2. host part DOES NOT start with "dg." AND path part is FALSY
    //      3. host part DOES NOT start with "dg." AND path part is TRUTHY
    // TODO: This can be refactored to be simplified
    if (parsedUrl.host.startsWith('dg.')) {
        if (!parsedUrl.pathname) {
            throw new Error(`Invalid URL: "${dataObjectUrl}"`);
        }
        // Note: The use of "dos" in the pathname might change to "drs" at some point and break things, so be on the lookout
        parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects/${parsedUrl.hostname}${parsedUrl.pathname}`;
        parsedUrl.host = config.dataObjectResolutionHost;
    } else if (parsedUrl.host && !parsedUrl.pathname) {
        parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects/${parsedUrl.hostname}`;
        parsedUrl.host = config.dataObjectResolutionHost;
    } else {
        parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects${parsedUrl.pathname}`;
    }

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

module.exports = {dataObjectUrlToHttps, bondBaseUrl, samBaseUrl, BondProviders, determineBondProvider};
