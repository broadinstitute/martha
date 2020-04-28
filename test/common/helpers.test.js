const test = require('ava');
const {dataObjectUriToHttps, samBaseUrl, jadeDataRepoUrl} = require('../../common/helpers');
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
        t.is(error.message, 'Data Object URIs with either \'dg.*\' or \'jade.datarepo-dev.broadinstitute.org\' as host are required to have a path: "dos://dg.4503"');
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

/**
 * Begin Scenario 4: data objects uri with jade data repo host
 */
test('should parse Data Object uri with jade data repo as host', (t) => {
    t.is(
        dataObjectUriToHttps(`drs://jade.datarepo-dev.broadinstitute.org/973b5e79-6433-40ce-bf38-686ab7f17820`),
        `https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/973b5e79-6433-40ce-bf38-686ab7f17820`
    );
});

test('should parse Data Object uri with jade data repo as host and path with snapshot id', (t) => {
    t.is(
        dataObjectUriToHttps(`drs://jade.datarepo-dev.broadinstitute.org/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820`),
        `https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820`
    );
});

test('should throw error if Data Object uri belongs to jade data repo hosts but not the one mentioned in config', (t) => {
    try {
        dataObjectUriToHttps(`drs://jade-terra.datarepo-prod.broadinstitute.org/anything`)
    } catch(error) {
        t.is(error.message, 'Data Object URI belongs to a different Jade Data Repo host. This version supports \'jade.datarepo-dev.broadinstitute.org\'. URL passed: \'drs://jade-terra.datarepo-prod.broadinstitute.org/anything\'')
    }
});

test('should throw error when given jade data repo host and no path', (t) => {
    try {
        dataObjectUriToHttps(`drs://jade.datarepo-dev.broadinstitute.org/`);
    } catch(error) {
        t.is(error.message, 'Data Object URIs with either \'dg.*\' or \'jade.datarepo-dev.broadinstitute.org\' as host are required to have a path: "drs://jade.datarepo-dev.broadinstitute.org"');
    }
});

test('should parse Data Object uri with host that looks like jade data repo host and use dos object prefix', (t) => {
    t.is(
        dataObjectUriToHttps(`drs://jade-data-repo.datarepo-dev.broadinstitute.org/v1_anything`),
        `https://jade-data-repo.datarepo-dev.broadinstitute.org/ga4gh/dos/v1/dataobjects/v1_anything`
    );
});
/**
 * End Scenario 4
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

test('jade data repo base url should come from the config json', (t) => {
    t.is(jadeDataRepoUrl(), config.jadeDataRepoBaseUrl);
});