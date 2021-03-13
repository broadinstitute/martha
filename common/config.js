/*
A half-way implementation between just a json `require('config.json')` and using the node module `require('config')`
 */

const fs = require('fs');
const path = require('path');

const ENV_MOCK='mock';
const ENV_DEV='dev';
const ENV_PROD='prod';
const ENV_CROMWELL_DEV='cromwell-dev';

const marthaEnv = (process.env.ENV || ENV_DEV).toLowerCase();
const dsdeEnv =
    (() => {
        // noinspection JSUnreachableSwitchBranches
        switch (marthaEnv) {
            case ENV_MOCK: return 'dev';
            case ENV_CROMWELL_DEV: return 'dev';
            default: return marthaEnv;
        }
    })().toLowerCase();

// Start with the defaults...
const configDefaults = {
    samBaseUrl:
        `https://sam.dsde-${dsdeEnv}.broadinstitute.org`,
    bondBaseUrl:
        (() => {
            // noinspection JSUnreachableSwitchBranches
            switch (marthaEnv) {
                case ENV_MOCK: return 'http://127.0.0.1:8080';
                default: return `https://broad-bond-${dsdeEnv}.appspot.com`;
            }
        })(),
    dataObjectResolutionHost:
        (() => {
            // noinspection JSUnreachableSwitchBranches
            switch (marthaEnv) {
                case ENV_MOCK: return 'wb-mock-drs-dev.storage.googleapis.com';
                case ENV_PROD: return 'gen3.biodatacatalyst.nhlbi.nih.gov';
                default: return 'staging.gen3.biodatacatalyst.nhlbi.nih.gov';
            }
        })(),
    // MLC add the BT-163 non-prod hosts here as per the `dataObjectResolutionHost` case above.
    itMarthaBaseUrl:
        (() => {
            // noinspection JSUnreachableSwitchBranches
            switch (marthaEnv) {
                case ENV_MOCK: return 'http://localhost:8010';
                default: return `https://martha-fiab.dsde-${dsdeEnv}.broadinstitute.org:32443`;
            }
        })(),
    itBondBaseUrl:
        (() => {
            // noinspection JSUnreachableSwitchBranches
            switch (marthaEnv) {
                case ENV_MOCK: return 'http://127.0.0.1:8080';
                default: return `https://bond-fiab.dsde-${dsdeEnv}.broadinstitute.org:31443`;
            }
        })(),
};

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
 * @property {string} dataObjectResolutionHost - Host (hostname + port) for calling BDC-or-mock-drs.
 *      Default: BDC staging.
 * @property {string} itMarthaBaseUrl - Base URL for calling Martha from integration-test code.
 *      Default: Martha in FiaB.
 * @property {string} itBondBaseUrl - Base URL for calling Bond from integration-test code.
 *      Default: Bond in FiaB.
 */
const configExport = Object.freeze({
    dsdeEnv,
    marthaEnv,
    ...removeUndefined(configDefaults),
    ...removeUndefined(configJson),
    ...removeUndefined(configEnv),
});

module.exports = configExport;
