const ENV_DEV='dev';

const marthaEnv = (process.env.ENV || ENV_DEV).toLowerCase();
const drshubUrl = `https://drshub.dsde-${marthaEnv}.broadinstitute.org`;

const configExport = Object.freeze({
    marthaEnv,
    drshubUrl,
});

module.exports = configExport;
