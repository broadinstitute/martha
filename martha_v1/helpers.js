const url = require('url');
const config = require('../config.json');

function dataObjectUrlToHttps(dataObjectUri) {
    const parsedUrl = url.parse(dataObjectUri);

    parsedUrl.protocol = 'https';

    // Note: The use of "dos" in the pathname might change to "drs" at some point and break things, so be on the lookout
    if (parsedUrl.host.startsWith('dg.')) {
        parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects/${parsedUrl.hostname}${parsedUrl.pathname}`;
        parsedUrl.host = config.dataObjectResolutionHost;
    } else {
        parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects${parsedUrl.pathname}`;
    }

    const output = url.format(parsedUrl);

    console.debug('Parsed to:', output);
    return output;
}

const bondBaseUrl = () => config.bondBaseUrl;
const samBaseUrl = () => config.samBaseUrl;


exports.dataObjectUrlToHttps = dataObjectUrlToHttps;
exports.bondBaseUrl = bondBaseUrl;
exports.samBaseUrl = samBaseUrl;
