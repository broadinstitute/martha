const helpers = require('./helpers');
const apiAdapter = require('./api_adapter');

function maybeTalkToBond(auth) {
    return apiAdapter.getJsonFrom(
        `${helpers.bondBaseUrl()}/api/link/v1/fence/serviceaccount/key`,
        auth
    ).then(
        (res) => res.data
    ).catch(() => {
        console.error('Unable to retrieve Service Account Key from Bond');
        return Promise.resolve();
    });
}

function maybeTalkToSam(auth) {
    return apiAdapter.getJsonFrom(
        `${helpers.samBaseUrl()}/api/google/v1/user/petServiceAccount/key`,
        auth
    ).catch((e) => {
        console.error('Unable to retrieve Pet Service Account Key from Sam');
        throw e;
    });
}

function getServiceAccountKey(auth, isDos) {
    if (isDos) {
        return maybeTalkToBond(auth);
    } else {
        return maybeTalkToSam(auth);
    }
}

exports.maybeTalkToBond = maybeTalkToBond;
exports.maybeTalkToSam = maybeTalkToSam;
exports.getServiceAccountKey = getServiceAccountKey;
