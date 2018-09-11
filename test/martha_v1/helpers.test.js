const test = require('ava');
const { dosToHttps } = require('../../martha_v1/helpers');
const config = require('../../config.json');

test('should parse dos uri', (t) => {
    t.is(dosToHttps('dos://foo/bar'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('should parse dg dos uri', (t) => {
    t.is(dosToHttps('dos://dg.2345/bar'), `https://${config.dosResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('should throw a TypeError when passed an invalid uri', (t) => {
    t.throws(() => {
        dosToHttps('A string that is not a valid URI');
    }, TypeError);
});
