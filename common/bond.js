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

const PROD_DATASTAGE_NAMESPACE = 'dg.4503';
const STAGING_DATASTAGE_NAMESPACE = 'dg.712c';
const ANVIL_NAMESPACE = 'dg.anv0';
const DATASTAGE_NAMESPACES = [PROD_DATASTAGE_NAMESPACE, STAGING_DATASTAGE_NAMESPACE];

const ANVIL_HOSTNAME = 'gen3.theanvil.io';

const bondBaseUrl = () => config.bondBaseUrl;

// We are explicitly listing the DOS/DRS host/namespaces here for both production and staging environments.
// At some point we expect to have a more sophisticated way to do this, but for now, we have to do it this way.
// If you update this function update the README too!
function determineBondProvider(urlString) {
    const url = URL.parse(urlString);

    if (DATASTAGE_NAMESPACES.includes(url.hostname.toLowerCase())) {
        return BondProviders.FENCE;
    }

    if ([ANVIL_NAMESPACE, ANVIL_HOSTNAME].includes(url.hostname.toLowerCase())) {
        return BondProviders.ANVIL;
    }

    if (url.hostname.endsWith('.humancellatlas.org')) {
        return;
    }

    if (hasJadeDataRepoHost(url)) {
        return;
    }

    return BondProviders.default;
}

module.exports = {bondBaseUrl, BondProviders, determineBondProvider};
