const config = require('../common/config');
const URL = require('url');
const { hasJadeDataRepoHost } = require('../common/helpers.js');
const apiAdapter = require('../common/api_adapter.js');

const BondProviders = Object.freeze({
    FENCE: 'fence',
    DCF_FENCE: 'dcf-fence',
    ANVIL: 'anvil',
    get default() {
        return this.DCF_FENCE;
    }
});
// CIB URIs via https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit#
const PROD_DATASTAGE_NAMESPACE = 'dg.4503';
const STAGING_DATASTAGE_NAMESPACE = 'dg.712c';
const ANVIL_NAMESPACE = 'dg.anv0';
const CRDC_NAMESPACE = 'dg.4dfc';
const KIDS_FIRST_NAMESPACE = 'dg.f82a1a';

const bondBaseUrl = () => config.bondBaseUrl;

// We are explicitly listing the DOS/DRS host/namespaces here for both production and staging environments.
// At some point we expect to have a more sophisticated way to do this, but for now, we have to do it this way.
// If you update this function update the README too!
function determineBondProvider(urlString) {

    const dgRegex = /(?:dos|drs):\/\/(dg.[a-z0-9-]+).*/i;
    const match = dgRegex.exec(urlString);
    if (match) {
        switch (match[1].toLowerCase()) {
            case PROD_DATASTAGE_NAMESPACE: return BondProviders.FENCE;
            case STAGING_DATASTAGE_NAMESPACE: return BondProviders.FENCE;
            case ANVIL_NAMESPACE: return BondProviders.ANVIL;
            case CRDC_NAMESPACE: return BondProviders.DCF_FENCE;
            case KIDS_FIRST_NAMESPACE: return;
            default: return BondProviders.default;
        }
    }

    const url = URL.parse(urlString);

    if (url.hostname.endsWith('.theanvil.io')) {
        return BondProviders.ANVIL;
    }

    if (url.hostname.endsWith('.humancellatlas.org')) {
        return;
    }

    if (url.hostname.endsWith('.datacommons.io')) {
        return BondProviders.DCF_FENCE;
    }

    if (hasJadeDataRepoHost(url)) {
        return;
    }

    return BondProviders.default;
}

async function maybeTalkToBond(auth, provider) {
    /*
       Currently HCA data access does not require additional credentials. HCA checkout buckets allow object
       read access for GROUP_All_Users@firecloud.org. Also for Jade Data Repo (JDR), we don't need to contact Bond to
       check proper authorization. JDR itself checks for the proper authorization when a metadata retrieval request for
       data object is made.
   */
    if (auth && provider) {
        try {
            /*
               Importing just `getJsonFrom` from api_adapter.js (at top) and replacing `apiAdapter.getJsonFrom` with
               `getJsonFrom(...)` is breaking martha_v2.test.js and martha_v3.test.js for some reason(!!). It might be the way
               `getJsonFrom` is mocked in the tests. Please do not change the import at top for this reason.
            */
            return await apiAdapter.getJsonFrom(`${bondBaseUrl()}/api/link/v1/${provider}/serviceaccount/key`, auth);
        } catch (error) {
            console.log(`Received error while fetching service account from Bond for provider '${provider}'.`);
            console.error(error);
            throw error;
        }
    } else {
        return Promise.resolve();
    }
}

module.exports = {bondBaseUrl, BondProviders, determineBondProvider, maybeTalkToBond};
