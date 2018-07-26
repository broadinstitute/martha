const url = require('url');
const config = require('./config.json');

function dosToHttps(dosUri) {
    const parsedUrl = url.parse(dosUri);
    const origPath = parsedUrl.pathname;
    let newPath = '/ga4gh/dos/v1/dataobjects' + origPath;

    // special case for hostless dos uris which will be better supported in martha v2
    if (parsedUrl.host.startsWith('dg.')) {
        newPath = '/ga4gh/dos/v1/dataobjects/' + parsedUrl.hostname + origPath;
        parsedUrl.host = config.dosResolutionHost;
    }

    console.log(newPath);
    parsedUrl.protocol = 'https';
    parsedUrl.path = newPath;
    parsedUrl.pathname = newPath;
    console.log(parsedUrl);
    console.log(parsedUrl.toString());
    return url.format(parsedUrl);
}

function bondBaseUrl() {
    return config.bondBaseUrl;
}

exports.dosToHttps = dosToHttps;
exports.bondBaseUrl = bondBaseUrl;
