const test = require('ava');
const { drsToHttps } = require('../../martha_v1/helpers');
const config = require('../../config.json');

test('should parse dos uri', (t) => {
    t.is(drsToHttps('dos://foo/bar'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('should parse drs uri', (t) => {
    t.is(drsToHttps('drs://foo/bar'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('should parse dg dos uri with dg. host', (t) => {
    t.is(drsToHttps('dos://dg.2345/bar'), `https://${config.drsResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('should throw a TypeError when passed an invalid uri', (t) => {
    t.throws(() => {
        drsToHttps('A string that is not a valid URI');
    }, TypeError);
});
