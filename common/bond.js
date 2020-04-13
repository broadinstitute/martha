const config = require('../config.json');
const URL = require('url');

const BondProviders = Object.freeze({
  FENCE: 'fence',
  DCF_FENCE: 'dcf-fence',
  HCA: 'hca', // Human Cell Atlas
  get default() {
    return this.DCF_FENCE;
  }
});

const PROD_DATASTAGE_NAMESPACE    = 'dg.4503';
const STAGING_DATASTAGE_NAMESPACE = 'dg.712c';
const DATASTAGE_NAMESPACES = [PROD_DATASTAGE_NAMESPACE, STAGING_DATASTAGE_NAMESPACE];

// We are explicitly listing the DOS/DRS host/namespaces here for both production and staging environments.
// At some point we expect to have a more sophisticated way to do this, but for now, we have to do it this way.
function determineBondProvider(urlString) {
  const url = URL.parse(urlString);
  if (DATASTAGE_NAMESPACES.includes(url.hostname.toLowerCase())) {
    return BondProviders.FENCE;
  } else if (url.host.endsWith('.humancellatlas.org')) {
    return BondProviders.HCA;
  } else {
    return BondProviders.default;
  }
}

const bondBaseUrl = () => config.bondBaseUrl;

module.exports = {bondBaseUrl, BondProviders, determineBondProvider};
