package org.broadinstitute.martha.models;

import java.util.List;
import java.util.stream.Collectors;

public abstract class DrsProvider {

  protected final String providerName;
  protected final boolean sendMetadataAuth;
  protected final BondProviderEnum bondProvider;
  protected final List<AccessMethod> accessMethods;
  protected final boolean forceAccessUrl;
  protected final boolean useAliasesForLocalizationPath;

  public DrsProvider(
      String providerName,
      boolean sendMetadataAuth,
      BondProviderEnum bondProvider,
      List<AccessMethod> accessMethods,
      boolean forceAccessUrl,
      boolean useAliasesForLocalizationPath) {
    this.providerName = providerName;
    this.sendMetadataAuth = sendMetadataAuth;
    this.bondProvider = bondProvider;
    this.accessMethods = accessMethods;
    this.forceAccessUrl = forceAccessUrl;
    this.useAliasesForLocalizationPath = useAliasesForLocalizationPath;
  }

  public DrsProvider(
      String providerName,
      boolean sendMetadataAuth,
      BondProviderEnum bondProvider,
      List<AccessMethod> accessMethods,
      boolean forceAccessUrl) {
    this(providerName, sendMetadataAuth, bondProvider, accessMethods, forceAccessUrl, false);
  }

  public AccessMethod getAccessMethodByType(AccessMethodTypeEnum accessMethodType) {
    return accessMethods.stream()
        .filter(o -> o.getAccessMethodType() == accessMethodType)
        .findFirst()
        .orElse(null);
  }

  public List<AccessMethodTypeEnum> getAccessMethodTypes() {
    return accessMethods.stream()
        .map(AccessMethod::getAccessMethodType)
        .collect(Collectors.toList());
  }

  /**
   * Should Martha call Bond to retrieve a Fence access token to use when later calling the `access`
   * endpoint to retrieve a signed URL. Should return `true` for Gen3 signed URL flows and `false`
   * otherwise, including TDR signed URL flows (TDR uses the same auth supplied to the current
   * Martha request for calling `access`).
   *
   * @param useFallbackAuth if false (default) check accessUrlAuth in accessMethods, otherwise check
   *     fallbackAccessUrlAuth
   */
  public boolean shouldFetchFenceAccessToken(
      AccessMethodTypeEnum accessMethodType,
      List<String> requestedFields,
      boolean useFallbackAuth) {
    return bondProvider != null
        && Fields.overlap(requestedFields, Fields.ACCESS_ID_FIELDS)
        && (forceAccessUrl
            || accessMethods.stream()
                .anyMatch(
                    m -> {
                      var accessMethodTypeMatches =
                          m.getAccessMethodType().equals(accessMethodType);
                      var validFallbackAuth =
                          !useFallbackAuth
                              || m.getFallbackAccessUrlAuth().orElse(null)
                                  == AccessUrlAuthEnum.FENCE_TOKEN;
                      var validAccessAuth =
                          useFallbackAuth || m.getAccessUrlAuth() == AccessUrlAuthEnum.FENCE_TOKEN;

                      return accessMethodTypeMatches
                          && validFallbackAuth
                          && validAccessAuth
                          && m.isFetchAccessUrl();
                    }));
  }

  /** Should Martha call the DRS provider's `access` endpoint to get a signed URL. */
  public boolean shouldFetchAccessUrl(
      AccessMethodTypeEnum accessMethodType, List<String> requestedFields) {
    return Fields.overlap(requestedFields, Fields.ACCESS_ID_FIELDS)
        && (forceAccessUrl
            || accessMethods.stream()
                .anyMatch(
                    m -> m.getAccessMethodType().equals(accessMethodType) && m.isFetchAccessUrl()));
  }

  /**
   * Should Martha fetch the Google user service account from Bond. Because this account is
   * Google-specific it should not be fetched if we know the underlying data is not GCS-based.
   */
  public boolean shouldFetchUserServiceAccount(
      AccessMethodTypeEnum accessMethodType, List<String> requestedFields) {
    // This account would be stored in Bond so no Bond means no account.
    return bondProvider != null
        // "Not definitely not GCS". A falsy accessMethod is okay because there may not have been a
        // preceding metadata request to determine the accessMethod.
        && (accessMethodType == null || accessMethodType == AccessMethodTypeEnum.GCS)
        && getAccessMethodTypes().contains(AccessMethodTypeEnum.GCS)
        && Fields.overlap(requestedFields, Fields.BOND_SA_FIELDS);
  }

  public boolean shouldFetchPassports(
      AccessMethodTypeEnum accessMethodType, List<String> requestedFields) {
    return Fields.overlap(requestedFields, Fields.ACCESS_ID_FIELDS)
        && accessMethods.stream()
            .anyMatch(
                m ->
                    m.getAccessMethodType() == accessMethodType
                        && m.getAccessUrlAuth() == AccessUrlAuthEnum.PASSPORT);
  }

  /**
   * Fail this request if Martha was unable to get an access/signed URL and the access method is
   * truthy but its type is not GCS. Martha clients currently can't deal with cloud paths other than
   * GCS so there isn't a fallback way of accessing the object. Note: TDR's metadata responses for
   * objects stored in GCS include an `https` access method with a URL and headers (the headers
   * containing the same bearer auth as in the TDR metadata request) which could be used for
   * download without fetching a signed URL. However this presumes that the URL downloaders in
   * Martha clients support headers, which at the time of this writing is not true at least for the
   * Cromwell localizer using getm 0.0.4. This also presumes that the Martha response would fall
   * back to a different access method than the GCS/Azure one for which Martha tried and failed to
   * get a signed URL. The current code does not support this.
   */
  public boolean shouldFailOnAccessUrlFail(AccessMethodTypeEnum accessMethodType) {
    return accessMethodType != AccessMethodTypeEnum.GCS;
  }

  public boolean shouldRequestMetadata(List<String> requestedFields) {
    return Fields.overlap(requestedFields, Fields.METADATA_FIELDS);
  }

  /**
   * This is hopefully a temporary measure until we can take the time to either get a new field
   * added to the DRS spec or implement a temporary spec extension with the Terra Data Repo team.
   * See BT-417 for more details.
   */
  public boolean useAliasesForLocalizationPath() {
    return useAliasesForLocalizationPath;
  }
}
