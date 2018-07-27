const helpers = require('./helpers');
const apiAdapter = require('./api_adapter');

function maybeTalkToBond(auth) {
    return apiAdapter.getJsonFrom(
        `${helpers.bondBaseUrl()}/api/link/v1/fence/serviceaccount/key`,
        auth
    ).catch((e) => {
        console.error("Problem while trying to talk to Bond");
        throw e;
    });
}

function maybeTalkToSam(auth) {
    return apiAdapter.getJsonFrom(
        `${helpers.samBaseUrl()}/api/google/v1/user/petServiceAccount/key`,
        auth
    ).catch((e) => {
        console.error("Problem while trying to talk to Sam");
        throw e;
    });
}

function getServiceAccountKey(auth, isDos) {
    if (isDos) {
        return maybeTalkToBond(auth).then((res) => res.data);
    } else {
        return maybeTalkToSam(auth);
    }
}

exports.maybeTalkToBond = maybeTalkToBond;
exports.maybeTalkToSam = maybeTalkToSam;
exports.getServiceAccountKey = getServiceAccountKey;