const test = require('ava');
const config = require('../../common/config');
const fs = require('fs');
const tmp = require('tmp');

test('configDefaultsFrom should get the right answer for the mock environment', (t) => {
    const expectedForMock = {
        samBaseUrl: `https://sam.dsde-dev.broadinstitute.org`,
        externalcredsBaseUrl: 'https://externalcreds.dsde-dev.broadinstitute.org',
        bondBaseUrl: 'http://127.0.0.1:8080',
        bioDataCatalystProdHost: config.HOST_MOCK_DRS,
        bioDataCatalystStagingHost: config.HOST_MOCK_DRS,
        bioDataCatalystLegacyHost: config.HOST_MOCK_DRS,
        theAnvilHost: config.HOST_MOCK_DRS,
        terraDataRepoHost: config.HOST_MOCK_DRS,
        crdcHost: config.HOST_MOCK_DRS,
        kidsFirstHost: config.HOST_MOCK_DRS,
        passportTestHost: config.HOST_MOCK_DRS,
        itMarthaBaseUrl: 'http://localhost:8010',
        itBondBaseUrl: 'http://127.0.0.1:8080',
        rasClientMTLSKeySecretName: 'projects/broad-dsde-dev/secrets/ras-mtls-client-key/versions/latest',
        rasClientMTLSCertSecretName: 'projects/broad-dsde-dev/secrets/ras-mtls-client-cert/versions/latest'
    };
    t.deepEqual(config.configDefaultsForEnv({ marthaEnv: config.ENV_MOCK }), expectedForMock);
});

test('configDefaultsFrom should get the right answer for the dev environment', (t) => {
    const expectedForDev = {
        samBaseUrl: `https://sam.dsde-dev.broadinstitute.org`,
        externalcredsBaseUrl: 'https://externalcreds.dsde-dev.broadinstitute.org',
        bondBaseUrl: 'https://broad-bond-dev.appspot.com',
        bioDataCatalystProdHost: config.HOST_BIODATA_CATALYST_PROD,
        bioDataCatalystStagingHost: config.HOST_BIODATA_CATALYST_STAGING,
        bioDataCatalystLegacyHost: config.HOST_BIODATA_CATALYST_STAGING,
        theAnvilHost: config.HOST_THE_ANVIL_STAGING,
        terraDataRepoHost: config.HOST_TERRA_DATA_REPO_STAGING,
        crdcHost: config.HOST_CRDC_STAGING,
        kidsFirstHost: config.HOST_KIDS_FIRST_STAGING,
        passportTestHost: config.HOST_PASSPORT_TEST,
        itMarthaBaseUrl: 'https://martha-fiab.dsde-dev.broadinstitute.org:32443',
        itBondBaseUrl: 'https://bond-fiab.dsde-dev.broadinstitute.org:31443',
        rasClientMTLSKeySecretName: 'projects/broad-dsde-dev/secrets/ras-mtls-client-key/versions/latest',
        rasClientMTLSCertSecretName: 'projects/broad-dsde-dev/secrets/ras-mtls-client-cert/versions/latest'
    };
    t.deepEqual(config.configDefaultsForEnv({ marthaEnv: config.ENV_DEV }), expectedForDev);
});

test('configDefaultsFrom should get the right answer for the Cromwell dev environment', (t) => {
    const expectedForCromwellDev = {
        samBaseUrl: `https://sam.dsde-dev.broadinstitute.org`,
        externalcredsBaseUrl: 'https://externalcreds.dsde-dev.broadinstitute.org',
        bondBaseUrl: 'https://broad-bond-dev.appspot.com',
        bioDataCatalystProdHost: config.HOST_BIODATA_CATALYST_PROD,
        bioDataCatalystStagingHost: config.HOST_BIODATA_CATALYST_STAGING,
        bioDataCatalystLegacyHost: config.HOST_BIODATA_CATALYST_STAGING,
        theAnvilHost: config.HOST_THE_ANVIL_STAGING,
        terraDataRepoHost: config.HOST_TERRA_DATA_REPO_STAGING,
        crdcHost: config.HOST_CRDC_STAGING,
        kidsFirstHost: config.HOST_KIDS_FIRST_STAGING,
        passportTestHost: config.HOST_PASSPORT_TEST,
        itMarthaBaseUrl: 'https://martha-fiab.dsde-dev.broadinstitute.org:32443',
        itBondBaseUrl: 'https://bond-fiab.dsde-dev.broadinstitute.org:31443',
        rasClientMTLSKeySecretName: 'projects/broad-dsde-cromwell-dev/secrets/ras-mtls-client-key/versions/latest',
        rasClientMTLSCertSecretName: 'projects/broad-dsde-cromwell-dev/secrets/ras-mtls-client-cert/versions/latest'
    };
    t.deepEqual(config.configDefaultsForEnv({ marthaEnv: config.ENV_CROMWELL_DEV }), expectedForCromwellDev);
});

test('configDefaultsFrom should get the right answer for the production environment', (t) => {
    const expectedForProduction = {
        samBaseUrl: `https://sam.dsde-prod.broadinstitute.org`,
        externalcredsBaseUrl: 'https://externalcreds.dsde-prod.broadinstitute.org',
        bondBaseUrl: 'https://broad-bond-prod.appspot.com',
        bioDataCatalystProdHost: config.HOST_BIODATA_CATALYST_PROD,
        bioDataCatalystStagingHost: config.HOST_BIODATA_CATALYST_STAGING,
        bioDataCatalystLegacyHost: config.HOST_BIODATA_CATALYST_PROD,
        theAnvilHost: config.HOST_THE_ANVIL_PROD,
        terraDataRepoHost: config.HOST_TERRA_DATA_REPO_PROD,
        crdcHost: config.HOST_CRDC_PROD,
        kidsFirstHost: config.HOST_KIDS_FIRST_PROD,
        passportTestHost: config.HOST_PASSPORT_TEST,
        itMarthaBaseUrl: 'https://martha-fiab.dsde-prod.broadinstitute.org:32443',
        itBondBaseUrl: 'https://bond-fiab.dsde-prod.broadinstitute.org:31443',
        rasClientMTLSKeySecretName: 'projects/broad-dsde-prod/secrets/ras-mtls-client-key/versions/latest',
        rasClientMTLSCertSecretName: 'projects/broad-dsde-prod/secrets/ras-mtls-client-cert/versions/latest'
    };
    t.deepEqual(config.configDefaultsForEnv({ marthaEnv: config.ENV_PROD }), expectedForProduction);
});

test('config parseConfigJson should parse a temp file in ENV_DEV', (t) => {
    const configPathTmp = tmp.fileSync();
    fs.writeSync(configPathTmp.fd, '{"hello": "world"}');
    const configJson = config.parseConfigJson({marthaEnv: config.ENV_DEV, configPath: configPathTmp.name});
    configPathTmp.removeCallback();
    t.deepEqual(configJson, {hello: 'world'});
});

test('config parseConfigJson should return an empty json in ENV_MOCK', (t) => {
    const configPathTmp = tmp.fileSync();
    fs.writeSync(configPathTmp.fd, '{"hello": "world"}');
    const configJson = config.parseConfigJson({marthaEnv: config.ENV_MOCK, configPath: configPathTmp.name});
    configPathTmp.removeCallback();
    t.deepEqual(configJson, {});
});

test('config parseConfigJson should return an empty json for a missing temp file in ENV_DEV', (t) => {
    const configPathTmp = tmp.fileSync();
    fs.writeSync(configPathTmp.fd, '{"hello": "world"}');
    configPathTmp.removeCallback(); // Delete the file before calling parseConfigJson
    const configJson = config.parseConfigJson({marthaEnv: config.ENV_DEV, configPath: configPathTmp.name});
    t.deepEqual(configJson, {});
});
