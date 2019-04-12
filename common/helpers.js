const url = require('url');
const config = require('../config.json');
const URL = require('url');

const dataGuidsHostPrefix = 'dg.';
const dataObjectPathPrefix = '/ga4gh/dos/v1/dataobjects/';

function hasDataGuidsHost(someUrl) {
    return someUrl.host.startsWith(dataGuidsHostPrefix);
}

function isDataGuidsUrl(someUrl) {
    return hasDataGuidsHost(someUrl) || (someUrl.hostname && !someUrl.pathname);
}

function validateDataObjectUrl(someUrl) {
    if (hasDataGuidsHost(someUrl) && !someUrl.pathname) {
        throw new Error(`Data Object URIs with '${dataGuidsHostPrefix}*' host are required to have a path: "${url.format(someUrl)}"`);
    }
}

/**
 *  Filter off the null entries first (because `regex.exec(null)` is TRUTHY, because of course it is)
 *  Then run the regex to get the path part without leading or trailing slashes
 *  Then filter out the null values that didn't match the regex
 *  Then join the parts back together with "/"
 */
function constructPath(pathParts) {
    const formattedParts = pathParts.filter((part) => part)
        .map(part => {
            const matches = pathSlashRegex.exec(part);
            return matches ? matches[1] : null;
        }).filter((part) => part);
    return formattedParts.join('/');
}

function determineHostname(someUrl) {
    return isDataGuidsUrl(someUrl) ? config.dataObjectResolutionHost : someUrl.hostname;
}

function determinePathname(someUrl) {
    if (isDataGuidsUrl(someUrl)) {
        return constructPath([dataObjectPathPrefix, someUrl.hostname, someUrl.pathname]);
    } else {
        return constructPath([dataObjectPathPrefix, someUrl.pathname]);
    }
}

// 3 Scenarios we need to account for:
//      1. host part starts with "dg."
//      2. host part DOES NOT start with "dg." AND path part is FALSY
//      3. host part DOES NOT start with "dg." AND path part is TRUTHY
function dataObjectUriToHttps(dataObjectUri) {
    const parsedUrl = url.parse(dataObjectUri);
    if (parsedUrl.pathname === '/') {
        parsedUrl.pathname = null;
    }

    validateDataObjectUrl(parsedUrl);

    const resolutionUrlParts = {
        protocol: 'https',
        hostname: determineHostname(parsedUrl),
        port: parsedUrl.port,
        pathname: determinePathname(parsedUrl),
        search: parsedUrl.search
    };

    const output = url.format(resolutionUrlParts);
    console.log(`${dataObjectUri} -> ${output}`);
    return output;
}

// Regex drops any leading or trailing "/" characters and gives the path out of capture group 1
const pathSlashRegex = /^\/?([^/]+.*?)\/?$/;

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

module.exports = {dataObjectUriToHttps, bondBaseUrl, samBaseUrl, BondProviders, determineBondProvider};
