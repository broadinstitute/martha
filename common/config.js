/*
A half-way implementation between just a json `require('config.json')` and using the node module `require('config')`
 */

const fs = require('fs');
const path = require('path');

const ENV_MOCK='mock';
const ENV_DEV='dev';
const ENV_PROD='prod';
const ENV_CROMWELL_DEV='cromwell-dev';

// Environmental defaults: 'dev'

// The env to test martha:
//   Options: 'prod', 'staging', 'qa', 'perf', 'alpha', 'dev', 'cromwell-dev', 'mock'
const marthaEnv = process.env.ENV || ENV_DEV;
const terraEnv =
    (() => {
        // noinspection JSUnreachableSwitchBranches
        switch (marthaEnv) {
        case ENV_MOCK: return 'dev';
        case ENV_CROMWELL_DEV: return 'dev';
        default: return marthaEnv;
        }
    })();

// Defaults
const configDefaults = {
    samBaseUrl:
        `https://sam.dsde-${terraEnv}.broadinstitute.org`,
    bondBaseUrl:
        (() => {
            // noinspection JSUnreachableSwitchBranches
            switch (marthaEnv) {
            case ENV_MOCK: return 'http://127.0.0.1:8080';
            default: return `https://broad-bond-${terraEnv}.appspot.com`;
            }
        })(),
    testMarthaBaseUrl:
        (() => {
            // noinspection JSUnreachableSwitchBranches
            switch (marthaEnv) {
            case ENV_MOCK: return 'http://localhost:8010';
            default:
            }
        })(),
    testBondBaseUrl:
        (() => {
            // noinspection JSUnreachableSwitchBranches
            switch (marthaEnv) {
            case ENV_MOCK: return 'http://127.0.0.1:8080';
            // For integration tests, match the config rendered by config.json.ctmpl and being used by the Martha
            // instance running in a FiaB container
            default: return `https://bond-fiab.dsde-${terraEnv}.broadinstitute.org:31443`;
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
};

// Override defaults with config.json
const configPath = process.env.MARTHA_CONFIG_FILE || path.join(__dirname, '../config.json');
const configText = fs.existsSync(configPath) ? fs.readFileSync(configPath) : '{}';
const configJson = JSON.parse(configText);

// Override config.json with environment variables
// noinspection JSCheckFunctionSignatures
const configEnv =
    (({
        BASE_URL,
        BOND_BASE_URL,
    }) => ({
        bondBaseUrl: BOND_BASE_URL,
        testMarthaBaseUrl: BASE_URL,
        testBondBaseUrl: BOND_BASE_URL,
    }))(process.env);

// Remove undefined fields
function removeUndefined(orig) {
    const obj = { ...orig };
    Object.keys(obj).forEach((key) => !obj[key] && delete obj[key]);
    return obj;
}

const configExport = Object.freeze({
    marthaEnv,
    terraEnv,
    ...removeUndefined(configDefaults),
    ...removeUndefined(configJson),
    ...removeUndefined(configEnv),
});

module.exports = configExport;
