const {
    BadRequestError,
    jadeDataRepoHostRegex
} = require("../common/helpers");

const config = require("../common/config");

const {
    MARTHA_V3_ACCESS_ID_FIELDS,
    MARTHA_V3_BOND_SA_FIELDS,
    overlapFields, MARTHA_V3_METADATA_FIELDS
} = require("./martha_fields");

const AccessMethodType = {
    GCS: 'gs',
    S3: 's3'
};

const AccessUrlAuth = {
    FENCE_TOKEN: "FENCE_TOKEN",
    CURRENT_REQUEST: "CURRENT_REQUEST"
};

const FetchAccessUrl = {
    YES: "YES",
    NO: "NO",
};

const BondProvider = {
    DCF_FENCE: 'dcf-fence',
    FENCE: 'fence',
    ANVIL: 'anvil',
    KIDS_FIRST: 'kids-first',
    NONE: null
};

const MetadataAuth = {
    YES: true,
    NO: false
};

class AccessMethod {
    constructor(accessMethodType, accessUrlAuth, fetchAccessUrl) {
        this.accessMethodType = accessMethodType;
        this.accessUrlAuth = accessUrlAuth;
        this.fetchAccessUrl = fetchAccessUrl;
    }
}

class DrsProvider {
    constructor(providerName, sendMetadataAuth, bondProvider, accessMethods) {
        this.providerName = providerName;
        this.sendMetadataAuth = sendMetadataAuth;
        this.bondProvider = bondProvider;
        this.accessMethods = accessMethods;
        // may be overridden in request headers or tests, set it explicitly here to placate eslint.
        this.forceAccessUrl = false;
    }

    accessMethodHavingSameTypeAs(accessMethod) {
        return this.accessMethods.find((o) => o.accessMethodType === accessMethod.type);
    }

    accessMethodTypes() {
        return this && this.accessMethods && this.accessMethods.map((m) => m.accessMethodType);
    }

    /**
     * Should Martha call Bond to retrieve a Fence access token to use when later calling the `access` endpoint to
     * retrieve a signed URL. Should return `true` for Gen3 signed URL flows and `false` otherwise, including TDR signed
     * URL flows (TDR uses the same auth supplied to the current Martha request for calling `access`).
     * @param accessMethod
     * @param requestedFields
     * @return {boolean}
     */
    shouldFetchFenceAccessToken(accessMethod, requestedFields) {
        return this.bondProvider &&
            overlapFields(requestedFields, MARTHA_V3_ACCESS_ID_FIELDS) &&
            (this.forceAccessUrl || (accessMethod &&
                this.accessMethods.find((m) => m.accessMethodType === accessMethod.type &&
                    m.accessUrlAuth === AccessUrlAuth.FENCE_TOKEN &&
                    m.fetchAccessUrl === FetchAccessUrl.YES)));
    }

    /**
     * Should Martha call the DRS provider's `access` endpoint to get a signed URL.
     * @param accessMethod
     * @param requestedFields
     * @return {boolean}
     */
    shouldFetchAccessUrl(accessMethod, requestedFields) {
        return overlapFields(requestedFields, MARTHA_V3_ACCESS_ID_FIELDS) &&
            (this.forceAccessUrl || (accessMethod &&
                this.accessMethods.find((m) => m.accessMethodType === accessMethod.type &&
                    m.fetchAccessUrl === FetchAccessUrl.YES)));
    }

    /**
     * Should Martha fetch the Google user service account from Bond. Because this account is Google-specific it should
     * not be fetched if we know the underlying data is not GCS-based.
     * @param accessMethod
     * @param requestedFields
     * @return {boolean}
     */
    shouldFetchUserServiceAccount(accessMethod, requestedFields) {
        // This account would be stored in Bond so no Bond means no account.
        return this.bondProvider !== BondProvider.NONE &&
            // "Not definitely not GCS". A falsy accessMethod is okay because there may not have been a preceding
            // metadata request to determine the accessMethod.
            (!accessMethod || accessMethod.type === AccessMethodType.GCS) &&
            this.accessMethodTypes().includes(AccessMethodType.GCS) &&
            overlapFields(requestedFields, MARTHA_V3_BOND_SA_FIELDS);
    }

    shouldFailOnAccessUrlFail(accessMethod) {
        // Fail this request if Martha was unable to get an access/signed URL and the access method is truthy but its
        // type is not GCS. Martha clients currently can't deal with cloud paths other than GCS so there isn't a
        // fallback way of accessing the object.
        // Note: TDR's metadata responses for objects stored in GCS include an `https` access method with a URL and
        // headers (the headers containing the same bearer auth as in the TDR metadata request) which could be used for
        // download without fetching a signed URL. However this presumes that the URL downloaders in Martha clients
        // support headers, which at the time of this writing is not true at least for the Cromwell localizer using getm
        // 0.0.4. This also presumes that the Martha response would fall back to a different access method than the
        // GCS/Azure one for which Martha tried and failed to get a signed URL. The current code does not support this.
        return this && accessMethod && accessMethod.type !== AccessMethodType.GCS;
    }

    shouldRequestMetadata(requestedFields) {
        return this && overlapFields(requestedFields, MARTHA_V3_METADATA_FIELDS);
    }

    accessUrlAuth(accessMethod, accessToken, requestAuth) {
        const providerAccessMethod = this.accessMethodHavingSameTypeAs(accessMethod);
        switch (providerAccessMethod.accessUrlAuth) {
            case AccessUrlAuth.FENCE_TOKEN:
                return `Bearer ${accessToken}`;
            case AccessUrlAuth.CURRENT_REQUEST:
                return requestAuth;
            default:
                throw new BadRequestError(
                    `Programmer error: 'accessUrlAuth' called with signed URL disposition ${providerAccessMethod.SignedUrlEnabled} for provider ${this.providerName}`);
        }
    }
}

// Define the default provider implementations here and insert them as the values in the `DrsProviderInstances` object
// below. Tests can override the map values to ensure providers work as expected with signed URLs on or off.
const BioDataCatalystDrsProvider = new DrsProvider(
    'BioData Catalyst (BDC)',
    MetadataAuth.NO,
    BondProvider.FENCE,
    [
        //  BT-236 BDC access (signed) URLs temporarily turned off
        new AccessMethod(AccessMethodType.GCS, AccessUrlAuth.FENCE_TOKEN, FetchAccessUrl.NO)
    ]
);

const TerraDataRepoDrsProvider = new DrsProvider(
    'Terra Data Repo (TDR)',
    MetadataAuth.YES,
    BondProvider.NONE,
    [
        new AccessMethod(AccessMethodType.GCS, AccessUrlAuth.CURRENT_REQUEST, FetchAccessUrl.NO)
    ]
);

const KidsFirstDrsProvider = new DrsProvider(
    'Gabriella Miller Kids First DRC',
    MetadataAuth.NO,
    BondProvider.KIDS_FIRST,
    [
        new AccessMethod(AccessMethodType.S3, AccessUrlAuth.FENCE_TOKEN, FetchAccessUrl.YES)
    ]
);

const AnvilDrsProvider = new DrsProvider(
    'NHGRI Analysis Visualization and Informatics Lab-space (The AnVIL)',
    MetadataAuth.NO,
    BondProvider.ANVIL,
    [
        new AccessMethod(AccessMethodType.GCS, AccessUrlAuth.FENCE_TOKEN, FetchAccessUrl.NO)
    ]
);

const CrdcProvider = new DrsProvider(
    'NCI Cancer Research / Proteomics Data Commons (CRDC / PDC)',
    MetadataAuth.NO,
    BondProvider.DCF_FENCE,
    [
        new AccessMethod(AccessMethodType.GCS, AccessUrlAuth.FENCE_TOKEN, FetchAccessUrl.NO),
        new AccessMethod(AccessMethodType.S3, AccessUrlAuth.FENCE_TOKEN, FetchAccessUrl.YES)
    ]
);

const DrsProviderInstances = {
    BIO_DATA_CATALYST: BioDataCatalystDrsProvider,
    CRDC_PDC: CrdcProvider,
    TERRA_DATA_REPO: TerraDataRepoDrsProvider,
    KIDS_FIRST: KidsFirstDrsProvider,
    ANVIL: AnvilDrsProvider
};

/** *************************************************************************************************
 * Here is where all the logic lives that pairs a particular kind of URI with its DRS Provider.
 *
 * @param url {String} The full URL to be tested
 * @param urlParts {Object} The URL parts to be tested
 * @param drsProviderInstances {Object} Mapping of DRS provider keys to implementations, useful for testing.
 * @return {DrsProvider}
 */
function determineDrsProvider(url, urlParts, drsProviderInstances = DrsProviderInstances) {
    const host = urlParts.httpsUrlHost;

    // BDC, but skip DOS/DRS URIs that might be a fake `martha_v2`-compatible BDC
    if ((host.endsWith('.biodatacatalyst.nhlbi.nih.gov') || (host === config.HOST_MOCK_DRS))
        && !urlParts.httpsUrlMaybeNotBdc) {
        return drsProviderInstances.BIO_DATA_CATALYST;
    }

    // The AnVIL
    if (host.endsWith('.theanvil.io')) {
        return drsProviderInstances.ANVIL;
    }

    // Jade Data Repo
    if (jadeDataRepoHostRegex.test(host)) {
        return drsProviderInstances.TERRA_DATA_REPO;
    }

    // CRDC / PDC
    if (host.endsWith('.datacommons.io')) {
        return drsProviderInstances.CRDC_PDC;
    }

    // Kids First
    if (host.endsWith('.kidsfirstdrc.org')) {
        return drsProviderInstances.KIDS_FIRST;
    }

    // RIP dataguids.org
    if (host.endsWith('dataguids.org')) {
        throw new BadRequestError('dataguids.org data has moved. See: https://support.terra.bio/hc/en-us/articles/360060681132');
    }

    // Fail explicitly for DRS ids for which Martha can not determine a provider.
    throw new BadRequestError(`Could not determine DRS provider for id '${url}'`);
}

exports.DrsProvider = DrsProvider;
exports.determineDrsProvider = determineDrsProvider;
exports.DrsProviderInstances = DrsProviderInstances;