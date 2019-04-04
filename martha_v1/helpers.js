const url = require('url');
const config = require('../config.json');

function drsToHttps(drsUri) {
    const parsedUrl = url.parse(drsUri);

    parsedUrl.protocol = 'https';

    // Note: The use of "dos" in the pathname might change to "drs" at some point and break things, so be on the lookout
    if (parsedUrl.host.startsWith('dg.')) {
        parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects/${parsedUrl.hostname}${parsedUrl.pathname}`;
        parsedUrl.host = config.drsResolutionHost;
    } else {
        parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects${parsedUrl.pathname}`;
    }

    const output = url.format(parsedUrl);

    console.debug('Parsed to:', output);
    return output;
}

const bondBaseUrl = () => config.bondBaseUrl;
const samBaseUrl = () => config.samBaseUrl;


exports.drsToHttps = drsToHttps;
exports.bondBaseUrl = bondBaseUrl;
exports.samBaseUrl = samBaseUrl;
