const test = require('ava');
const {dataObjectUriToHttps, bondBaseUrl, samBaseUrl, BondProviders, determineBondProvider} = require('../../common/helpers');
const config = require('../../config.json');

/**
 *Begin Scenario 1: data objects uri with non-dg host and path
 */
test('dataObjectUriToHttps should parse dos:// Data Object uri', (t) => {
    t.is(dataObjectUriToHttps('dos://foo/bar'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('dataObjectUriToHttps should parse drs:// Data Object uri', (t) => {
    t.is(dataObjectUriToHttps('drs://foo/bar'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('dataObjectUriToHttps should parse drs:// Data Object uri with "/" path', (t) => {
    t.is(dataObjectUriToHttps('drs://foo/bar/'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('dataObjectUriToHttps should parse drs:// Data Object uri with query part', (t) => {
    t.is(dataObjectUriToHttps('drs://foo/bar?version=1&bananas=yummy'), 'https://foo/ga4gh/dos/v1/dataobjects/bar?version=1&bananas=yummy');
});

test('dataObjectUriToHttps should parse drs:// Data Object uri when host includes a port number', (t) => {
    t.is(dataObjectUriToHttps('drs://foo.com:1234/bar'), 'https://foo.com:1234/ga4gh/dos/v1/dataobjects/bar');
});
/**
 * End Scenario 1
 */

/**
 * Begin Scenario 2: data objects uri with dg host
 */
test('dataObjectUriToHttps should parse "dos://dg." Data Object uri to use dataObjectResolutionHost', (t) => {
    t.is(dataObjectUriToHttps('dos://dg.2345/bar'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('dataObjectUriToHttps should parse "drs://dg." Data Object uri to use dataObjectResolutionHost', (t) => {
    t.is(dataObjectUriToHttps('drs://dg.2345/bar'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('dataObjectUriToHttps should parse "drs://dg." Data Object uri with "/" path to use dataObjectResolutionHost', (t) => {
    t.is(dataObjectUriToHttps('drs://dg.2345/bar/'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('dataObjectUriToHttps should parse "drs://dg." Data Object uri with query part to use dataObjectResolutionHost', (t) => {
    t.is(dataObjectUriToHttps('drs://dg.2345/bar?version=1&bananas=yummy'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar?version=1&bananas=yummy`);
});

test('dataObjectUriToHttps should throw an error when given a "dg.*" host with no path', (t) => {
    t.throws(() => {
        dataObjectUriToHttps('dos://dg.4503');
    }, Error);
});
/**
 * End Scenario 2
 */

/**
 * Begin Scenario 3: data objects uri with non-dg host and NO path
 */
test('should parse "dos://dg." Data Object uri with only a host part without a path', (t) => {
    t.is(dataObjectUriToHttps('dos://foo-bar-baz'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/foo-bar-baz`);
});

test('should parse "drs://dg." Data Object uri with only a host part without a path', (t) => {
    t.is(dataObjectUriToHttps('drs://foo-bar-baz'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/foo-bar-baz`);
});

test('should parse "drs://dg." Data Object uri with only a host part with a "/" path', (t) => {
    t.is(dataObjectUriToHttps('drs://foo-bar-baz/'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/foo-bar-baz`);
});

test('should parse "drs://dg." Data Object uri with only a host part with a query part', (t) => {
    t.is(dataObjectUriToHttps('drs://foo-bar-baz?version=1&bananas=yummy'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/foo-bar-baz?version=1&bananas=yummy`);
});
/**
 * End Scenario 3
 */

test('dataObjectUriToHttps should throw a Error when passed an invalid uri', (t) => {
    t.throws(() => {
        dataObjectUriToHttps('A string that is not a valid URI');
    }, Error);
});

test('bondBaseUrl should come from the config json', (t) => {
    t.is(bondBaseUrl(), config.bondBaseUrl);
});

test('samBaseUrl should come from the config json', (t) => {
    t.is(samBaseUrl(), config.samBaseUrl);
});

test('BondProviders default should be "dcf-fence"', (t) => {
    t.is(BondProviders.default, BondProviders.DCF_FENCE);
});

test('BondProviders should contain "dcf-fence" and "fence"', (t) => {
    t.truthy(BondProviders.DCF_FENCE);
    t.truthy(BondProviders.FENCE);
});

test('determineBondProvider should be "fence" if the URL host is "dg.4503"', (t) => {
    t.is(determineBondProvider('drs://dg.4503/anything'), BondProviders.FENCE);
});

test('determineBondProvider should be "HCA" if the URL host ends with ".humancellatlas.org"', (t) => {
    t.is(determineBondProvider('drs://someservice.humancellatlas.org'), BondProviders.HCA);
});

test('determineBondProvider should return the default BondProvider if the URL host does not end with ' +
    'exactly ".humancellatlas.org"', (t) => {
    t.is(determineBondProvider('drs://someservice.spoofhumancellatlas.org'), BondProviders.default);
});

test('determineBondProvider should return the default BondProvider if the URL host is NOT "dg.4503" or HCA', (t) => {
    t.is(determineBondProvider('drs://some-host/anything'), BondProviders.default);
});
