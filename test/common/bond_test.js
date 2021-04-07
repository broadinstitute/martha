const test = require('ava');
const { bondBaseUrl, BondProviders, determineBondProvider } = require('../../common/bond');
const config = require('../../common/config');

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

test('determineBondProvider should be "dcf-fence" if the URL host is "dg.4DFC"', (t) => {
    t.is(determineBondProvider('drs://dg.4DFC/anything'), BondProviders.DCF_FENCE);
});

test('determineBondProvider should not return a provider if the URL host is "dg.F82A1A"', (t) => {
    t.falsy(determineBondProvider('drs://dg.F82A1A/anything'));
});

test('determineBondProvider should be "dcf-fence" if the URL host is "dg.foo"', (t) => {
    t.is(determineBondProvider('drs://dg.foo/anything'), BondProviders.DCF_FENCE);
});

test('determineBondProvider should return the default BondProvider if the URL host is NOT "dg.4503" or HCA', (t) => {
    t.is(determineBondProvider('drs://some-host/anything'), BondProviders.default);
});

test('determineBondProvider should not return a provider if the URL host is JDR dev"', (t) => {
    t.falsy(determineBondProvider('drs://jade.datarepo-dev.broadinstitute.org/identifier'));
});

test('determineBondProvider should not return a provider if the URL host is JDR prod"', (t) => {
    t.falsy(determineBondProvider('drs://data.terra.bio/identifier'));
});

test('determineBondProvider should return the AnVIL BondProvider if the URL host is the AnVIL prefix dg.ANV0', (t) => {
    t.is(determineBondProvider('drs://dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0'), BondProviders.ANVIL);
});

test('determineBondProvider should return the AnVIL BondProvider if the URL host is the AnVIL prod host', (t) => {
    t.is(determineBondProvider(`drs://${config.HOST_THE_ANVIL_PROD}/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`), BondProviders.ANVIL);
});

test('determineBondProvider should return the AnVIL BondProvider if the URL host is the AnVIL staging host', (t) => {
    t.is(determineBondProvider(`drs://${config.HOST_THE_ANVIL_STAGING}/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`), BondProviders.ANVIL);
});

test('determineBondProvider should return the dcf-fence BondProvider if the URL host is Kids First prod', (t) => {
    /* This assertion test the current behavior of Martha with respect to Kids First and not necessarily what will be
       required for proper Kids First support. */
    t.is(
        determineBondProvider(`drs://${config.HOST_KIDS_FIRST_PROD}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`),
        BondProviders.DCF_FENCE,
    );
});

test('determineBondProvider should return the dcf-fence BondProvider if the URL host is Kids First staging', (t) => {
    /* This assertion test the current behavior of Martha with respect to Kids First and not necessarily what will be
       required for proper Kids First support. */
    t.is(
        determineBondProvider(`drs://${config.HOST_KIDS_FIRST_STAGING}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`),
        BondProviders.DCF_FENCE,
    );
});

test('determineBondProvider should return the dcf-fence BondProvider if the URL host is CRDC prod', (t) => {
    t.is(
        determineBondProvider(`drs://${config.HOST_CRDC_PROD}/0027045b-9ed6-45af-a68e-f55037b5184c`),
        BondProviders.DCF_FENCE,
    );
});

test('determineBondProvider should return the dcf-fence BondProvider if the URL host is CRDC staging', (t) => {
    t.is(
        determineBondProvider(`drs://${config.HOST_CRDC_STAGING}/0027045b-9ed6-45af-a68e-f55037b5184c`),
        BondProviders.DCF_FENCE,
    );
});

test(
    'determineBondProvider should return the dcf-fence BondProvider if the URL host is drs.dev.singlecell.gi.ucsc.edu',
    (t) => {
        t.is(
            determineBondProvider(
                'drs://drs.dev.singlecell.gi.ucsc.edu' +
                '/bee7a822-ea28-4374-8e18-8b9941392723?version=2019-05-15T205839.080730Z'
            ),
            BondProviders.DCF_FENCE,
        );
    }
);
