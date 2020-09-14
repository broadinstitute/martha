const config = require('../config.json');
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

const PROD_DATASTAGE_NAMESPACE = 'dg.4503';
const STAGING_DATASTAGE_NAMESPACE = 'dg.712c';
const ANVIL_NAMESPACE = 'dg.anv0';
const DATASTAGE_NAMESPACES = [PROD_DATASTAGE_NAMESPACE, STAGING_DATASTAGE_NAMESPACE];

const bondBaseUrl = () => config.bondBaseUrl;

// We are explicitly listing the DOS/DRS host/namespaces here for both production and staging environments.
// At some point we expect to have a more sophisticated way to do this, but for now, we have to do it this way.
function determineBondProvider(urlString) {
    const url = URL.parse(urlString);

    if (DATASTAGE_NAMESPACES.includes(url.hostname.toLowerCase())) {
        return BondProviders.FENCE;
    }

    if (ANVIL_NAMESPACE === url.hostname.toLowerCase()) {
        return BondProviders.ANVIL;
    }

    if (url.host.endsWith('.humancellatlas.org')) {
        return;
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
