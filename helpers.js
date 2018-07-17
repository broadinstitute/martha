const url = require("url");
const config = require("./config.json");

function dosToHttps(dosUri) {
    var parsed_url = url.parse(dosUri);
    var orig_path = parsed_url.pathname;
    var new_path = '/ga4gh/dos/v1/dataobjects' + orig_path;

    // special case for hostless dos uris which will be better supported in martha v2
    if (parsed_url.host.startsWith("dg.")) {
        new_path = '/ga4gh/dos/v1/dataobjects/' + parsed_url.hostname + orig_path;
        parsed_url.host = config.dosResolutionHost;
    }

    console.log(new_path);
    parsed_url.protocol = 'https';
    parsed_url.path = new_path;
    parsed_url.pathname = new_path;
    console.log(parsed_url);
    console.log(parsed_url.toString);
    return url.format(parsed_url);
}

function bondBaseUrl() {
    return config.bondBaseUrl;
}

exports.dosToHttps = dosToHttps;
exports.bondBaseUrl = bondBaseUrl;