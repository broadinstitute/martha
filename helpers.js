const url = require('url');
const config = require('./config.json');

function dosToHttps(dosUri) {
    console.debug('Parsing:', dosUri);

    const parsedUrl = url.parse(dosUri);

    parsedUrl.protocol = 'https';

    if (parsedUrl.host.startsWith('dg.')) {
        parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects/${parsedUrl.hostname}${parsedUrl.pathname}`;
        parsedUrl.host = config.dosResolutionHost;
    } else {
        parsedUrl.pathname = `/ga4gh/dos/v1/dataobjects${parsedUrl.pathname}`;
    }

    const output = url.format(parsedUrl);

    console.debug('Parsed to:', output);
    return output;
}

const bondBaseUrl = () => config.bondBaseUrl;
const samBaseUrl = () => config.samBaseUrl;


exports.dosToHttps = dosToHttps;
exports.bondBaseUrl = bondBaseUrl;
exports.samBaseUrl = samBaseUrl;
