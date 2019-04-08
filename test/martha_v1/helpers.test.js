const test = require('ava');
const { dataObjectUrlToHttps } = require('../../martha_v1/helpers');
const config = require('../../config.json');

test('should parse dos:// Data Object uri', (t) => {
    t.is(dataObjectUrlToHttps('dos://foo/bar'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('should parse drs:// Data Object uri', (t) => {
    t.is(dataObjectUrlToHttps('drs://foo/bar'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('should parse dg Data Object uri with dg. host', (t) => {
    t.is(dataObjectUrlToHttps('dos://dg.2345/bar'), `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('should throw a TypeError when passed an invalid uri', (t) => {
    t.throws(() => {
        dataObjectUrlToHttps('A string that is not a valid URI');
    }, TypeError);
});
