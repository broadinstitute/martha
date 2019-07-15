const {bondBaseUrl, samBaseUrl, determineBondProvider, BondProviders} = require('../common/helpers');
const apiAdapter = require('../common/api_adapter');

function maybeTalkToBond(auth, url) {
    const provider = determineBondProvider(url);

    if (provider === BondProviders.HCA) {
        return Promise.resolve();
    }

    return apiAdapter.getJsonFrom(
        `${bondBaseUrl()}/api/link/v1/${provider}/serviceaccount/key`,
        auth
    ).then(
        (res) => res.data
    ).catch(() => {
        console.error(new Error('Unable to retrieve Service Account Key from Bond'));
        return Promise.resolve();
    });
}

function maybeTalkToSam(auth) {
    return apiAdapter.getJsonFrom(
        `${samBaseUrl()}/api/google/v1/user/petServiceAccount/key`,
        auth
    ).catch((e) => {
        console.error(new Error('Unable to retrieve Pet Service Account Key from Sam'));
        throw e;
    });
}

function getServiceAccountKey(url, auth, isDataObject) {
    if (isDataObject) {
        return maybeTalkToBond(auth, url);
    } else {
        return maybeTalkToSam(auth);
    }
}

exports.maybeTalkToBond = maybeTalkToBond;
exports.maybeTalkToSam = maybeTalkToSam;
exports.getServiceAccountKey = getServiceAccountKey;
