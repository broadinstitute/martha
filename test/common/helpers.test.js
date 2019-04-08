const test = require('ava');
const {dataObjectUrlToHttps, bondBaseUrl, samBaseUrl, BondProviders, determineBondProvider} = require('../../common/helpers');
const config = require('../../config.json');

test('dataObjectUrlToHttps should parse dos:// Data Object uri', (t) => {
    t.is(dataObjectUrlToHttps('dos://foo/bar'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/bar`);
});

test('dataObjectUrlToHttps should parse drs:// Data Object uri', (t) => {
    t.is(dataObjectUrlToHttps('drs://foo/bar'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/bar`);
});

// This is a legacy test because martha_v1 treated dos urls with a "dg.*" host differently than other urls
test('dataObjectUrlToHttps should parse dg Data Object uri to use dataObjectResolutionHost', (t) => {
    t.is(dataObjectUrlToHttps('dos://dg.2345/bar'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/bar`);
});

test('dataObjectUrlToHttps should throw a Error when passed an invalid uri', (t) => {
    t.throws(() => {
        dataObjectUrlToHttps('A string that is not a valid URI');
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

test('determineBondProvider should return the default BondProvider if the URL host is NOT "dg.4503"', (t) => {
    t.is(determineBondProvider('drs://some-host/anything'), BondProviders.default);
});