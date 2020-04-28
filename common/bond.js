const config = require('../config.json');
const URL = require('url');
const {hasJadeDataRepoHost} = require('../common/helpers.js');
const apiAdapter = require('../common/api_adapter.js');

const BondProviders = Object.freeze({
  FENCE: 'fence',
  DCF_FENCE: 'dcf-fence',
  HCA: 'hca', // Human Cell Atlas,
  JADE_DATA_REPO: 'jade-data-repo',
  get default() {
    return this.DCF_FENCE;
  }
});

const PROD_DATASTAGE_NAMESPACE    = 'dg.4503';
const STAGING_DATASTAGE_NAMESPACE = 'dg.712c';
const DATASTAGE_NAMESPACES = [PROD_DATASTAGE_NAMESPACE, STAGING_DATASTAGE_NAMESPACE];

const bondBaseUrl = () => config.bondBaseUrl;

// We are explicitly listing the DOS/DRS host/namespaces here for both production and staging environments.
// At some point we expect to have a more sophisticated way to do this, but for now, we have to do it this way.
function determineBondProvider(urlString) {
  const url = URL.parse(urlString);
  if (DATASTAGE_NAMESPACES.includes(url.hostname.toLowerCase())) {
    return BondProviders.FENCE;
  } else if (url.host.endsWith('.humancellatlas.org')) {
    return BondProviders.HCA;
  } else if (hasJadeDataRepoHost(url)) {
    return BondProviders.JADE_DATA_REPO;
  } else {
    return BondProviders.default;
  }
}

async function maybeTalkToBond(req, provider = BondProviders.default) {
  /*
      Currently HCA data access does not require additional credentials. HCA checkout buckets allow object
      read access for GROUP_All_Users@firecloud.org. Also for Jade Data Repo (JDR), we don't need to contact Bond to
      check proper authorization. When a metadata retrieval request is made to JDR, we need to pass authorization
      which is used to check permissions of that account.
   */
  if (req && req.headers &&
      req.headers.authorization &&
      provider !== BondProviders.HCA &&
      provider !== BondProviders.JADE_DATA_REPO) {
    try {
      /*
          For some reason, importing just `getJsonFrom` from api_adapter.js (at top) and replacing `apiAdapter.getJsonFrom` with
          `getJsonFrom(...)` is breaking martha_v2.test.js and martha_v3.test.js(!!)
       */
      return await apiAdapter.getJsonFrom(`${bondBaseUrl()}/api/link/v1/${provider}/serviceaccount/key`, req.headers.authorization);
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
