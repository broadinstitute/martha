/*
A half-way implementation between just a json `require('config.json')` and using the node module `require('config')`
 */

const fs = require('fs');
const path = require('path');

const ENV_MOCK='mock';
const ENV_DEV='dev';
const ENV_PROD='prod';
const ENV_CROMWELL_DEV='cromwell-dev';

const HOST_MOCK_DRS='wb-mock-drs-dev.storage.googleapis.com';
const HOST_BIODATA_CATALYST_PROD = 'gen3.biodatacatalyst.nhlbi.nih.gov';
const HOST_BIODATA_CATALYST_STAGING = 'staging.gen3.biodatacatalyst.nhlbi.nih.gov';
const HOST_THE_ANVIL_PROD = 'gen3.theanvil.io';
const HOST_THE_ANVIL_STAGING = 'staging.theanvil.io';
const HOST_CRDC_PROD = 'nci-crdc.datacommons.io';
const HOST_CRDC_STAGING = 'nci-crdc-staging.datacommons.io';
const HOST_KIDS_FIRST_PROD = 'data.kidsfirstdrc.org';
const HOST_KIDS_FIRST_STAGING = 'gen3staging.kidsfirstdrc.org';

/**
 * Return the DSDE environment for the specified Martha environment.
 * @param _marthaEnv {string} Martha environment, should be one of the constants ENV_MOCK, ENV_DEV, ENV_PROD,
 *        or ENV_CROMWELL_DEV.
 * @returns {string}
 */
function dsdeEnvFrom(_marthaEnv) {
    switch (_marthaEnv) {
        case ENV_MOCK: return 'dev';
        case ENV_CROMWELL_DEV: return 'dev';
        default: return _marthaEnv.toLowerCase();
    }
}

/**
 * Return a configuration object with default values for the specified Martha and DSDE environments.
 * @param _marthaEnv
 * @param _dsdeEnv
 * @returns {{theAnvilHost: (string), crdcHost: (string), kidsFirstHost: (string), bondBaseUrl: string, itMarthaBaseUrl: string, itBondBaseUrl: string, samBaseUrl: string, bioDataCatalystHost: (string)}}
 */
function configDefaultsFrom(_marthaEnv, _dsdeEnv) {
    return {
        samBaseUrl:
            `https://sam.dsde-${_dsdeEnv}.broadinstitute.org`,
        bondBaseUrl:
            (() => {
                // noinspection JSUnreachableSwitchBranches
                switch (_marthaEnv) {
                    case ENV_MOCK:
                        return 'http://127.0.0.1:8080';
                    default:
                        return `https://broad-bond-${_dsdeEnv}.appspot.com`;
                }
            })(),
        bioDataCatalystHost:
            (() => {
                switch (_marthaEnv) {
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
                switch (_marthaEnv) {
                    case ENV_MOCK:
                        return HOST_MOCK_DRS;
                    case ENV_PROD:
                        return HOST_THE_ANVIL_PROD;
                    default:
                        return HOST_THE_ANVIL_STAGING;
                }
            })(),
        crdcHost:
            (() => {
                switch (_marthaEnv) {
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
                switch (_marthaEnv) {
                    case ENV_MOCK:
                        return HOST_MOCK_DRS;
                    case ENV_PROD:
                        return HOST_KIDS_FIRST_PROD;
                    default:
                        return HOST_KIDS_FIRST_STAGING;
                }
            })(),
        itMarthaBaseUrl:
            (() => {
                // noinspection JSUnreachableSwitchBranches
                switch (_marthaEnv) {
                    case ENV_MOCK:
                        return 'http://localhost:8010';
                    default:
                        return `https://martha-fiab.dsde-${_dsdeEnv}.broadinstitute.org:32443`;
                }
            })(),
        itBondBaseUrl:
            (() => {
                // noinspection JSUnreachableSwitchBranches
                switch (_marthaEnv) {
                    case ENV_MOCK:
                        return 'http://127.0.0.1:8080';
                    default:
                        return `https://bond-fiab.dsde-${_dsdeEnv}.broadinstitute.org:31443`;
                }
            })(),
    };
}

const marthaEnv = (process.env.ENV || ENV_DEV).toLowerCase();

const dsdeEnv = dsdeEnvFrom(marthaEnv);

// Start with the defaults...
const configDefaults = configDefaultsFrom(marthaEnv, dsdeEnv);
// ...override defaults with config.json...
const configPath = process.env.MARTHA_CONFIG_FILE || path.join(__dirname, '../config.json');
const configText = marthaEnv !== ENV_MOCK && fs.existsSync(configPath) ? fs.readFileSync(configPath) : '{}';
const configJson = JSON.parse(configText);

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
 * @property {string} bioDataCatalystHost Host (hostname + port) for calling DRS resolvers (production or staging)
 *      or mock DRS for BioData Catalyst.
 * @property {string} theAnvilHost (hostname + port) for calling DRS resolvers (production or staging)
 *      or mock DRS for the AnVIL.
 * @property {string} crdcHost (hostname + port) for calling DRS resolvers (production or staging)
 *      or mock DRS for CRDC.
 * @property {string} kidsFirstHost (hostname + port) for calling DRS resolvers (production or staging)
 *      or mock DRS for Kids First.
 * @property {string} itMarthaBaseUrl - Base URL for calling Martha from integration-test code.
 *      Default: Martha in FiaB.
 * @property {string} itBondBaseUrl - Base URL for calling Bond from integration-test code.
 *      Default: Bond in FiaB.
 */
const configExport = Object.freeze({
    HOST_MOCK_DRS,
    HOST_BIODATA_CATALYST_PROD,
    HOST_BIODATA_CATALYST_STAGING,
    HOST_THE_ANVIL_PROD,
    HOST_THE_ANVIL_STAGING,
    HOST_CRDC_PROD,
    HOST_CRDC_STAGING,
    HOST_KIDS_FIRST_PROD,
    HOST_KIDS_FIRST_STAGING,
    dsdeEnv,
    marthaEnv,
    ...removeUndefined(configDefaults),
    ...removeUndefined(configJson),
    ...removeUndefined(configEnv),
});

module.exports = configExport;
