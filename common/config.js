/*
A half-way implementation between just a json `require('config.json')` and using the node module `require('config')`
 */

const fs = require('fs');
const path = require('path');

const ENV_MOCK='mock';
const ENV_PROD='prod';
const ENV_STAGING='staging';
const ENV_ALPHA='alpha';
const ENV_DEV='dev';
const ENV_CROMWELL_DEV='cromwell-dev';

const HOST_MOCK_DRS='wb-mock-drs-dev.storage.googleapis.com';
const HOST_BIODATA_CATALYST_PROD = 'gen3.biodatacatalyst.nhlbi.nih.gov';
const HOST_BIODATA_CATALYST_STAGING = 'staging.gen3.biodatacatalyst.nhlbi.nih.gov';
const HOST_THE_ANVIL_PROD = 'gen3.theanvil.io';
const HOST_THE_ANVIL_STAGING = 'staging.theanvil.io';
const HOST_TERRA_DATA_REPO_PROD = 'data.terra.bio';
const HOST_TERRA_DATA_REPO_STAGING = 'staging.data.terra.bio';
const HOST_TERRA_DATA_REPO_ALPHA = 'alpha.data.terra.bio';
const HOST_TDR_DEV = 'jade.datarepo-dev.broadinstitute.org';
const HOST_CRDC_PROD = 'nci-crdc.datacommons.io';
const HOST_CRDC_STAGING = 'nci-crdc-staging.datacommons.io';
const HOST_KIDS_FIRST_PROD = 'data.kidsfirstdrc.org';
const HOST_KIDS_FIRST_STAGING = 'gen3staging.kidsfirstdrc.org';
const HOST_PASSPORT_TEST = 'ctds-test-env.planx-pla.net';

/**
 * Return the DSDE environment for the specified Martha environment.
 * @param marthaEnv {string} Martha environment
 * @returns {string} DSDE environment
 */
function dsdeEnvFrom(marthaEnv) {
    const lowerMarthaEnv = marthaEnv.toLowerCase();
    switch (lowerMarthaEnv) {
        case ENV_MOCK:
        case ENV_CROMWELL_DEV:
        case ENV_DEV:
            return ENV_DEV;
        default:
            return lowerMarthaEnv;
    }
}

/**
 * Return a configuration object with default values for the specified Martha and DSDE environments.
 * @param marthaEnv {string} Martha environment (mock, dev, prod etc.)
 * @param dsdeEnv {string} The DSDE environment (qa, staging, dev, prod etc.)
 * @returns {{
 *   bioDataCatalystLegacyHost: (string),
 *   bioDataCatalystProdHost: (string),
 *   bioDataCatalystStagingHost: (string),
 *   bondBaseUrl: string,
 *   externalcredsBaseUrl: string,
 *   itBondBaseUrl: string,
 *   itMarthaBaseUrl: string,
 *   kidsFirstHost: (string),
 *   passportTestHost: string,
 *   samBaseUrl: string,
 *   theAnvilHost: (string),
 * }}
 */
function configDefaultsForEnv({marthaEnv, dsdeEnv = dsdeEnvFrom(marthaEnv)}) {
    return {
        samBaseUrl:
            `https://sam.dsde-${dsdeEnv}.broadinstitute.org`,
        bondBaseUrl:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return 'http://127.0.0.1:8080';
                    default:
                        return `https://broad-bond-${dsdeEnv}.appspot.com`;
                }
            })(),
        externalcredsBaseUrl:
          `https://externalcreds.dsde-${dsdeEnv}.broadinstitute.org`,
        bioDataCatalystProdHost:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return HOST_MOCK_DRS;
                    default:
                        return HOST_BIODATA_CATALYST_PROD;
                }
            })(),
        bioDataCatalystStagingHost:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return HOST_MOCK_DRS;
                    default:
                        return HOST_BIODATA_CATALYST_STAGING;
                }
            })(),
        /*
        Retain existing backwards compatibility for:
        - fileSummaryV1
        - getSignedUrlV1
        - martha_v2

        This variable should be removed once the full functionality for the above endpoints is implemented by martha_v3.

        See BT-203 for more information.
         */
        bioDataCatalystLegacyHost:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return HOST_MOCK_DRS;
                    case ENV_PROD:
                        return HOST_BIODATA_CATALYST_PROD;
                    default:
                        return HOST_BIODATA_CATALYST_STAGING;
                }
            })(),
        theAnvilHost:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return HOST_MOCK_DRS;
                    case ENV_PROD:
                        return HOST_THE_ANVIL_PROD;
                    default:
                        return HOST_THE_ANVIL_STAGING;
                }
            })(),
        terraDataRepoHost:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return HOST_MOCK_DRS;
                    case ENV_PROD:
                        return HOST_TERRA_DATA_REPO_PROD;
                    case ENV_STAGING:
                        return HOST_TERRA_DATA_REPO_STAGING;
                    case ENV_ALPHA:
                        return HOST_TERRA_DATA_REPO_ALPHA;
                    case ENV_DEV:
                    case ENV_CROMWELL_DEV:
                        return HOST_TDR_DEV;
                    default:
                        console.log(`Unsupported environment: '${marthaEnv}'.`);
                }
            })(),
        crdcHost:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return HOST_MOCK_DRS;
                    case ENV_PROD:
                        return HOST_CRDC_PROD;
                    default:
                        return HOST_CRDC_STAGING;
                }
            })(),
        kidsFirstHost:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return HOST_MOCK_DRS;
                    case ENV_PROD:
                        return HOST_KIDS_FIRST_PROD;
                    default:
                        return HOST_KIDS_FIRST_STAGING;
                }
            })(),
        passportTestHost:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return HOST_MOCK_DRS;
                    default:
                        return HOST_PASSPORT_TEST;
                }
            })(),
        itMarthaBaseUrl:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return 'http://localhost:8010';
                    default:
                        return `https://martha-fiab.dsde-${dsdeEnv}.broadinstitute.org:32443`;
                }
            })(),
        itBondBaseUrl:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return 'http://127.0.0.1:8080';
                    default:
                        return `https://bond-fiab.dsde-${dsdeEnv}.broadinstitute.org:31443`;
                }
            })(),
        rasClientMTLSKeySecretName:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return 'projects/broad-dsde-dev/secrets/ras-mtls-client-key/versions/latest';
                    default:
                        return `projects/broad-dsde-${marthaEnv}/secrets/ras-mtls-client-key/versions/latest`;
                }
            })(),
        rasClientMTLSCertSecretName:
            (() => {
                switch (marthaEnv) {
                    case ENV_MOCK:
                        return 'projects/broad-dsde-dev/secrets/ras-mtls-client-cert/versions/latest';
                    default:
                        return `projects/broad-dsde-${marthaEnv}/secrets/ras-mtls-client-cert/versions/latest`;
                }
            })(),
    };
}

function parseConfigJson({marthaEnv, configPath}) {
    const configText = marthaEnv !== ENV_MOCK && fs.existsSync(configPath) ? fs.readFileSync(configPath) : '{}';
    return JSON.parse(configText);
}

const marthaEnv = (process.env.ENV || ENV_DEV).toLowerCase();
const dsdeEnv = dsdeEnvFrom(marthaEnv);

// Start with the defaults...
const configDefaults = configDefaultsForEnv({ marthaEnv, dsdeEnv });
// ...override defaults with config.json...
const configJson = parseConfigJson({
    marthaEnv,
    configPath: process.env.MARTHA_CONFIG_FILE || path.join(__dirname, '../config.json'),
});

// ...finally enable setting integration test variables using environment variables.
// noinspection JSCheckFunctionSignatures
const configEnv =
    (({
        BASE_URL,
        BOND_BASE_URL,
    }) => ({
        itMarthaBaseUrl: BASE_URL,
        itBondBaseUrl: BOND_BASE_URL,
    }))(process.env);

// Remove undefined fields
function removeUndefined(orig) {
    const obj = { ...orig };
    Object.keys(obj).forEach((key) => !obj[key] && delete obj[key]);
    return obj;
}

/**
 * @type {object}
 * @property {string} dsdeEnv - Which DSDE environment to use for various servers such as Sam or Bond.
 *      One of: 'prod', 'staging', 'qa', 'perf', 'alpha', 'dev'.
 *      Default: `dev`.
 * @property {string} marthaEnv - An expanded set of environments to use for Martha and BDC-or-Mock-DRS.
 *      One of: 'prod', 'staging', 'qa', 'perf', 'alpha', 'dev', 'cromwell-dev', 'mock'.
 *      Default: `dev`.
 * @property {string} samBaseUrl - Base URL for calling Sam.
 *      Default: Sam in dsde-dev.
 * @property {string} bondBaseUrl - Base URL for calling Bond.
 *      Default: Bond in dsde-dev.
 * @property {string} externalcredsBaseUrl - Base URL for calling External Credentials Manager.
 *      Default: Externalcreds in dsde-dev.
 * @property {string} bioDataCatalystProdHost Host (hostname + port) for calling DRS resolvers (production)
 *      or mock DRS for BioData Catalyst.
 * @property {string} bioDataCatalystStagingHost Host (hostname + port) for calling DRS resolvers (staging)
 *      or mock DRS for BioData Catalyst.
 * @property {string} bioDataCatalystLegacyHost Host (hostname + port) for calling DRS resolvers (production or staging)
 *      or mock DRS for BioData Catalyst, only for use by pre-martha_v3 code!
 * @property {string} theAnvilHost (hostname + port) for calling DRS resolvers (production or staging)
 *      or mock DRS for the AnVIL.
 * @property {string} terraDataRepoHost (hostname + port) for calling DRS resolvers (production or staging)
 *      or mock DRS for Terra Data Repo.
 * @property {string} crdcHost (hostname + port) for calling DRS resolvers (production or staging)
 *      or mock DRS for CRDC.
 * @property {string} kidsFirstHost (hostname + port) for calling DRS resolvers (production or staging)
 *      or mock DRS for Kids First.
 * @property {string} passportTestHost (hostname + port) for calling DRS resolvers (production or staging)
 *      or mock DRS for Passport testing.
 * @property {string} itMarthaBaseUrl - Base URL for calling Martha from integration-test code.
 *      Default: Martha in FiaB.
 * @property {string} itBondBaseUrl - Base URL for calling Bond from integration-test code.
 *      Default: Bond in FiaB.
 * @property {string} rasClientMTLSKeySecretName - name of secret in google secret manager for mTLS client key
 *      when using RAS passports
 * @property {string} rasClientMTLSCertSecretName - name of secret in google secret manager for mTLS client certificate
 *      when using RAS passports
 */
const configExport = Object.freeze({
    HOST_MOCK_DRS,
    HOST_BIODATA_CATALYST_PROD,
    HOST_BIODATA_CATALYST_STAGING,
    HOST_THE_ANVIL_PROD,
    HOST_THE_ANVIL_STAGING,
    HOST_TERRA_DATA_REPO_PROD,
    HOST_TERRA_DATA_REPO_STAGING,
    HOST_TERRA_DATA_REPO_ALPHA,
    HOST_TDR_DEV,
    HOST_CRDC_PROD,
    HOST_CRDC_STAGING,
    HOST_KIDS_FIRST_PROD,
    HOST_KIDS_FIRST_STAGING,
    HOST_PASSPORT_TEST,
    ENV_PROD,
    ENV_DEV,
    ENV_MOCK,
    ENV_CROMWELL_DEV,
    configDefaultsForEnv,
    parseConfigJson,
    dsdeEnv,
    marthaEnv,
    ...removeUndefined(configDefaults),
    ...removeUndefined(configJson),
    ...removeUndefined(configEnv),
});

module.exports = configExport;
