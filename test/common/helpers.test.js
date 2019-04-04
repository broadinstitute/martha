const test = require('ava');
const {drsToHttps, bondBaseUrl, samBaseUrl, BondProviders, determineBondProvider} = require('../../common/helpers');
const config = require('../../config.json');

test('drsToHttps should parse dos uri', (t) => {
    t.is(drsToHttps('dos://foo/bar'), `https://${config.drsResolutionHost}/ga4gh/dos/v1/dataobjects/bar`);
});

test('drsToHttps should parse drs uri', (t) => {
    t.is(drsToHttps('drs://foo/bar'), `https://${config.drsResolutionHost}/ga4gh/dos/v1/dataobjects/bar`);
});

// This is a legacy test because martha_v1 treated dos urls with a "dg.*" host differently than other urls
test('drsToHttps should parse dg dos uri to use drsResolutionHost', (t) => {
    t.is(drsToHttps('dos://dg.2345/bar'), `https://${config.drsResolutionHost}/ga4gh/dos/v1/dataobjects/bar`);
});

test('drsToHttps should throw a Error when passed an invalid uri', (t) => {
    t.throws(() => {
        drsToHttps('A string that is not a valid URI');
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