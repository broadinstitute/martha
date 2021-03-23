const test = require('ava');
const config = require('../../common/config');

test('dsdeEnvFrom should say prod for prod and dev for all other Martha environments', (t) => {
    const envs = [
        config.ENV_MOCK,
        config.ENV_DEV,
        config.ENV_PROD,
        config.ENV_CROMWELL_DEV
    ];

    function expectation(env) {
        if (env === config.ENV_PROD) { return config.ENV_PROD; }
        return config.ENV_DEV;
    }

    for (const env of envs) {
        t.is(config.dsdeEnvFrom(env), expectation(env));
    }
});

test('configDefaultsFrom should get the right answer for the mock environment', (t) => {
    const expectedForMock = {
        samBaseUrl: `https://sam.dsde-dev.broadinstitute.org`,
        bondBaseUrl: 'http://127.0.0.1:8080',
        bioDataCatalystHost: config.HOST_MOCK_DRS,
        theAnvilHost: config.HOST_MOCK_DRS,
        crdcHost: config.HOST_MOCK_DRS,
        kidsFirstHost: config.HOST_MOCK_DRS,
        itMarthaBaseUrl: 'http://localhost:8010',
        itBondBaseUrl: 'http://127.0.0.1:8080'
    };
    t.deepEqual(config.configDefaultsForEnv({ marthaEnv: config.ENV_MOCK }), expectedForMock);
});

test('configDefaultsFrom should get the right answer for the dev environment', (t) => {
    const expectedForDev = {
        samBaseUrl: `https://sam.dsde-dev.broadinstitute.org`,
        bondBaseUrl: 'https://broad-bond-dev.appspot.com',
        bioDataCatalystHost: config.HOST_BIODATA_CATALYST_STAGING,
        theAnvilHost: config.HOST_THE_ANVIL_STAGING,
        crdcHost: config.HOST_CRDC_STAGING,
        kidsFirstHost: config.HOST_KIDS_FIRST_STAGING,
        itMarthaBaseUrl: 'https://martha-fiab.dsde-dev.broadinstitute.org:32443',
        itBondBaseUrl: 'https://bond-fiab.dsde-dev.broadinstitute.org:31443'
    };
    t.deepEqual(config.configDefaultsForEnv({ marthaEnv: config.ENV_DEV }), expectedForDev);
});

test('configDefaultsFrom should get the right answer for the Cromwell dev environment', (t) => {
    const expectedForCromwellDev = {
        samBaseUrl: `https://sam.dsde-dev.broadinstitute.org`,
        bondBaseUrl: 'https://broad-bond-dev.appspot.com',
        bioDataCatalystHost: config.HOST_BIODATA_CATALYST_STAGING,
        theAnvilHost: config.HOST_THE_ANVIL_STAGING,
        crdcHost: config.HOST_CRDC_STAGING,
        kidsFirstHost: config.HOST_KIDS_FIRST_STAGING,
        itMarthaBaseUrl: 'https://martha-fiab.dsde-dev.broadinstitute.org:32443',
        itBondBaseUrl: 'https://bond-fiab.dsde-dev.broadinstitute.org:31443'
    };
    t.deepEqual(config.configDefaultsForEnv({ marthaEnv: config.ENV_CROMWELL_DEV }), expectedForCromwellDev);
});

test('configDefaultsFrom should get the right answer for the production environment', (t) => {
    const expectedForProduction = {
        samBaseUrl: `https://sam.dsde-prod.broadinstitute.org`,
        bondBaseUrl: 'https://broad-bond-prod.appspot.com',
        bioDataCatalystHost: config.HOST_BIODATA_CATALYST_PROD,
        theAnvilHost: config.HOST_THE_ANVIL_PROD,
        crdcHost: config.HOST_CRDC_PROD,
        kidsFirstHost: config.HOST_KIDS_FIRST_PROD,
        itMarthaBaseUrl: 'https://martha-fiab.dsde-prod.broadinstitute.org:32443',
        itBondBaseUrl: 'https://bond-fiab.dsde-prod.broadinstitute.org:31443'
    };
    t.deepEqual(config.configDefaultsForEnv({ marthaEnv: config.ENV_PROD }), expectedForProduction);
});
