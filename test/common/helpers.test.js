const test = require('ava');
const {dosToHttps, bondBaseUrl, samBaseUrl, BondProviders, determineBondProvider} = require('../../common/helpers');
const config = require('../../config.json');

test('dosToHttps should parse dos uri', (t) => {
    t.is(dosToHttps('dos://foo/bar'), `https://${config.dosResolutionHost}/ga4gh/dos/v1/dataobjects/bar`);
});

// This is a legacy test because martha_v1 treated dos urls with a "dg.*" host differently than other urls
test('dosToHttps should parse dg dos uri to use dosResolutionHost', (t) => {
    t.is(dosToHttps('dos://dg.2345/bar'), `https://${config.dosResolutionHost}/ga4gh/dos/v1/dataobjects/bar`);
});

test('dosToHttps should throw a Error when passed an invalid uri', (t) => {
    t.throws(() => {
        dosToHttps('A string that is not a valid URI');
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
    t.is(determineBondProvider("dos://dg.4503/anything"), BondProviders.FENCE);
});

test('determineBondProvider should return the default BondProvider if the URL host is NOT "dg.4503"', (t) => {
    t.is(determineBondProvider("dos://some-host/anything"), BondProviders.default);
});