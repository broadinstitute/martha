const test = require('ava');
const { bondBaseUrl, BondProviders, determineBondProvider } = require('../../common/bond');
const config = require('../../config.json');

test('bondBaseUrl should come from the config json', (t) => {
    t.is(bondBaseUrl(), config.bondBaseUrl);
});

test('BondProviders default should be "dcf-fence"', (t) => {
    t.is(BondProviders.default, BondProviders.DCF_FENCE);
});

test('BondProviders should contain "dcf-fence" and "fence" and "anvil"', (t) => {
    t.truthy(BondProviders.DCF_FENCE);
    t.truthy(BondProviders.FENCE);
    t.truthy(BondProviders.ANVIL);
});

test('determineBondProvider should be "dcf-fence" if the URL host is "dataguids.org"', (t) => {
    t.is(
        determineBondProvider('dos://dataguids.org/a41b0c4f-ebfb-4277-a941-507340dea85d'),
        BondProviders.DCF_FENCE
    );
});

test('determineBondProvider should be "fence" if the URL host is "dg.4503"', (t) => {
    t.is(determineBondProvider('drs://dg.4503/anything'), BondProviders.FENCE);
});

test('determineBondProvider should be "fence" if the URL host is "dg.712C"', (t) => {
    t.is(determineBondProvider('drs://dg.712C/anything'), BondProviders.FENCE);
});

test('determineBondProvider should be "dcf-fence" if the URL host is "dg.foo"', (t) => {
    t.is(determineBondProvider('drs://dg.foo/anything'), BondProviders.DCF_FENCE);
});

test('determineBondProvider should be "HCA" if the URL host ends with ".humancellatlas.org"', (t) => {
    t.falsy(determineBondProvider('drs://someservice.humancellatlas.org'));
});

test('determineBondProvider should return the default BondProvider if the URL host does not end with ' +
  'exactly ".humancellatlas.org"', (t) => {
    t.is(determineBondProvider('drs://someservice.spoofhumancellatlas.org'), BondProviders.default);
});

test('determineBondProvider should return the default BondProvider if the URL host is NOT "dg.4503" or HCA', (t) => {
    t.is(determineBondProvider('drs://some-host/anything'), BondProviders.default);
});

test('determineBondProvider should return the "jade-data-repo" as the provider for JDR host"', (t) => {
    t.falsy(determineBondProvider('drs://jade.datarepo-dev.broadinstitute.org/identifier'));
});
