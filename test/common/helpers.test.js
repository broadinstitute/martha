const test = require('ava');
const {dataObjectUriToHttps, samBaseUrl} = require('../../common/helpers');
const config = require('../../config.json');

/**
 *Begin Scenario 1: data objects uri with non-dg host and path
 */
test('dataObjectUriToHttps should parse dos:// Data Object uri', (t) => {
    t.is(dataObjectUriToHttps('dos://foo/bar'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('dataObjectUriToHttps should parse dos:// Data Object uri and preserve case', (t) => {
    t.is(dataObjectUriToHttps('dos://FoO/BAR'), 'https://FoO/ga4gh/dos/v1/dataobjects/BAR');
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

test('dataObjectUriToHttps should parse "dos://dg." Data Object uri to use dataObjectResolutionHost and preserve case', (t) => {
    t.is(dataObjectUriToHttps('dos://dg.2345AbCdE/bAr'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345AbCdE/bAr`);
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
    try {
        dataObjectUriToHttps('dos://dg.4503');
    } catch(error) {
        t.is(error.message, 'Data Object URIs with \'dg.*\' host are required to have a path: "dos://dg.4503"');
    }
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
    try {
        dataObjectUriToHttps('A string that is not a valid URI');
    } catch(error) {
        t.is(error.message, 'Cannot read property \'0\' of null');
    }
});

test('samBaseUrl should come from the config json', (t) => {
    t.is(samBaseUrl(), config.samBaseUrl);
});
