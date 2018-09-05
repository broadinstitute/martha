const test = require('ava');
const { dosToHttps } = require('../../common/helpers');
const config = require('../../config.json');

test('should parse dos uri', (t) => {
    t.is(dosToHttps('dos://foo/bar'), `https://${config.dosResolutionHost}/ga4gh/dos/v1/dataobjects/bar`);
});

// This is a legacy test because martha_v1 treated dos urls with a "dg.*" host differently than other urls
test('should parse dg dos uri to use dosResolutionHost', (t) => {
    t.is(dosToHttps('dos://dg.2345/bar'), `https://${config.dosResolutionHost}/ga4gh/dos/v1/dataobjects/bar`);
});

test('should throw a Error when passed an invalid uri', (t) => {
    t.throws(() => {
        dosToHttps('A string that is not a valid URI');
    }, Error);
});