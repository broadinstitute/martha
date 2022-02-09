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

const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

const AccessMethodType = {
    GCS: 'gs',
    S3: 's3',
    HTTPS: 'https'
};

const AccessUrlAuth = {
    FENCE_TOKEN: "FENCE_TOKEN",
    CURRENT_REQUEST: "CURRENT_REQUEST",
    PASSPORT: "PASSPORT"
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
    constructor(accessMethodType, accessUrlAuth, fetchAccessUrl, fallbackAccessUrlAuth) {
        this.accessMethodType = accessMethodType;
        this.accessUrlAuth = accessUrlAuth;
        this.fetchAccessUrl = fetchAccessUrl;
        this.fallbackAccessUrlAuth = fallbackAccessUrlAuth;
    }
}

class DrsProvider {
    constructor(providerName, sendMetadataAuth, bondProvider, accessMethods, forceAccessUrl, options, clientPrivateKeySecretName, clientCertSecretName) {
        const defaultOptions = { usesAliasesForLocalizationPath: false };
        this.options = { ...defaultOptions, ...options };
        this.providerName = providerName;
        this.sendMetadataAuth = sendMetadataAuth;
        this.bondProvider = bondProvider;
        this.accessMethods = accessMethods;
        this.forceAccessUrl = forceAccessUrl;
        this.clientPrivateKeySecretName = clientPrivateKeySecretName;
        this.clientCertSecretName = clientCertSecretName;
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
     * @param useFallbackAuth if false (default) check accessUrlAuth in accessMethods, otherwise check fallbackAccessUrlAuth
     * @return {boolean}
     */
    shouldFetchFenceAccessToken(accessMethod, requestedFields, useFallbackAuth) {
        return this.bondProvider &&
            overlapFields(requestedFields, MARTHA_V3_ACCESS_ID_FIELDS) &&
            (this.forceAccessUrl || (accessMethod &&
                this.accessMethods.find((m) => m.accessMethodType === accessMethod.type &&
                    (!useFallbackAuth || m.fallbackAccessUrlAuth === AccessUrlAuth.FENCE_TOKEN) &&
                    (useFallbackAuth || m.accessUrlAuth === AccessUrlAuth.FENCE_TOKEN) &&
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

    shouldFetchPassports(accessMethod, requestedFields) {
        return overlapFields(requestedFields, MARTHA_V3_ACCESS_ID_FIELDS) &&
            accessMethod &&
            this.accessMethods.find((m) => m.accessMethodType === accessMethod.type &&
                m.accessUrlAuth === AccessUrlAuth.PASSPORT);
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

    /**
     * This is hopefully a temporary measure until we can take the time to either get a new field
     * added to the DRS spec or implement a temporary spec extension with the Terra Data Repo team.
     * See BT-417 for more details.
     */
    usesAliasesForLocalizationPath() {
        return this.options.usesAliasesForLocalizationPath;
    }
}

class BioDataCatalystDrsProvider extends DrsProvider {
    constructor(forceAccessUrl) {
        super('BioData Catalyst (BDC)',
            MetadataAuth.NO,
            BondProvider.FENCE,
            [
                //  BT-236 BDC access (signed) URLs temporarily turned off
                new AccessMethod(AccessMethodType.GCS, AccessUrlAuth.FENCE_TOKEN, FetchAccessUrl.NO)
            ],
            forceAccessUrl);
    }
}

class TerraDataRepoDrsProvider extends DrsProvider {
    constructor(forceAccessUrl) {
        super('Terra Data Repo (TDR)',
            MetadataAuth.YES,
            BondProvider.NONE,
            [
                new AccessMethod(AccessMethodType.GCS, AccessUrlAuth.CURRENT_REQUEST, FetchAccessUrl.NO),
                new AccessMethod(AccessMethodType.HTTPS, AccessUrlAuth.CURRENT_REQUEST, FetchAccessUrl.YES) // Used for Azure
            ],
            forceAccessUrl,
            { usesAliasesForLocalizationPath: true }
        );
    }
}

class KidsFirstDrsProvider extends DrsProvider {
    constructor(forceAccessUrl) {
        super('Gabriella Miller Kids First DRC',
            MetadataAuth.NO,
            BondProvider.KIDS_FIRST,
            [
                new AccessMethod(AccessMethodType.S3, AccessUrlAuth.FENCE_TOKEN, FetchAccessUrl.YES)
            ],
            forceAccessUrl
        );
    }
}

class AnvilDrsProvider extends DrsProvider {
    constructor(forceAccessUrl) {
        super(
            'NHGRI Analysis Visualization and Informatics Lab-space (The AnVIL)',
            MetadataAuth.NO,
            BondProvider.ANVIL,
            [
                new AccessMethod(AccessMethodType.GCS, AccessUrlAuth.FENCE_TOKEN, FetchAccessUrl.NO)
            ],
            forceAccessUrl
        );
    }
}

class CrdcProvider extends DrsProvider {
    constructor(forceAccessUrl) {
        super('NCI Cancer Research / Proteomics Data Commons (CRDC / PDC)',
            MetadataAuth.NO,
            BondProvider.DCF_FENCE,
            [
                new AccessMethod(AccessMethodType.GCS, AccessUrlAuth.FENCE_TOKEN, FetchAccessUrl.NO),
                new AccessMethod(AccessMethodType.S3, AccessUrlAuth.FENCE_TOKEN, FetchAccessUrl.YES)
            ],
            forceAccessUrl);
    }
}

class PassportTestDrsProvider extends DrsProvider {
    constructor(forceAccessUrl) {
        super(
            'Passport Test Provider',
            MetadataAuth.NO,
            BondProvider.DCF_FENCE,
            [
                new AccessMethod(AccessMethodType.GCS, AccessUrlAuth.PASSPORT, FetchAccessUrl.YES, AccessUrlAuth.FENCE_TOKEN),
                new AccessMethod(AccessMethodType.S3, AccessUrlAuth.PASSPORT, FetchAccessUrl.YES, AccessUrlAuth.FENCE_TOKEN)
            ],
            forceAccessUrl,
            undefined,
            config.rasClientMTLSKeySecretName,
            config.rasClientMTLSCertSecretName
        );
    }
}

/** *************************************************************************************************
 * Here is where all the logic lives that pairs a particular kind of URI with its DRS Provider.
 *
 * @param url {String} The full URL to be tested
 * @param urlParts {Object} The URL parts to be tested
 * @param forceAccessUrl {Boolean} Whether to force Martha to call `access` for a (signed) access URL.
 * @return {DrsProvider}
 */
function determineDrsProvider(url, urlParts, forceAccessUrl) {
    const host = urlParts.httpsUrlHost;

    // BDC, but skip DOS/DRS URIs that might be a fake `martha_v2`-compatible BDC
    if ((host.endsWith('.biodatacatalyst.nhlbi.nih.gov') || (host === config.HOST_MOCK_DRS))
        && !urlParts.httpsUrlMaybeNotBdc) {
        return new BioDataCatalystDrsProvider(forceAccessUrl);
    }

    // The AnVIL
    if (host.endsWith('.theanvil.io')) {
        return new AnvilDrsProvider(forceAccessUrl);
    }

    // Jade Data Repo
    if (jadeDataRepoHostRegex.test(host)) {
        return new TerraDataRepoDrsProvider(forceAccessUrl);
    }

    // CRDC / PDC
    if (host.endsWith('.datacommons.io')) {
        return new CrdcProvider(forceAccessUrl);
    }

    // Kids First
    if (host.endsWith('.kidsfirstdrc.org')) {
        return new KidsFirstDrsProvider(forceAccessUrl);
    }

    // RIP dataguids.org
    if (host.endsWith('dataguids.org')) {
        throw new BadRequestError('dataguids.org data has moved. See: https://support.terra.bio/hc/en-us/articles/360060681132');
    }

    if (host === config.HOST_PASSPORT_TEST) {
        return new PassportTestDrsProvider(forceAccessUrl);
    }

    // Fail explicitly for DRS ids for which Martha can not determine a provider.
    throw new BadRequestError(`Could not determine DRS provider for id '${url}'`);
}

exports.DrsProvider = DrsProvider;
exports.determineDrsProvider = determineDrsProvider;
exports.AccessUrlAuth = AccessUrlAuth;
