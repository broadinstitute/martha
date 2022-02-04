package org.broadinstitute.martha.config;

import java.util.List;
import java.util.stream.Collectors;
import org.broadinstitute.martha.models.AccessMethodTypeEnum;
import org.broadinstitute.martha.models.AccessUrlAuthEnum;
import org.broadinstitute.martha.models.BondProviderEnum;
import org.broadinstitute.martha.models.Fields;
import org.immutables.value.Value;

@Value.Modifiable
@PropertiesInterfaceStyle
public interface DrsProvider {

  String getName();

  String getHostRegex();

  boolean isMetadataAuth();

  BondProviderEnum getBondProvider();

  List<AccessMethod> getAccessMethods();

  /**
   * This is hopefully a temporary measure until we can take the time to either get a new field
   * added to the DRS spec or implement a temporary spec extension with the Terra Data Repo team.
   * See BT-417 for more details.
   */
  default boolean useAliasesForLocalizationPath() {
    return false;
  }

  default AccessMethod getAccessMethodByType(AccessMethodTypeEnum accessMethodType) {
    return getAccessMethods().stream()
        .filter(o -> o.getType() == accessMethodType)
        .findFirst()
        .orElse(null);
  }

  default List<AccessMethodTypeEnum> getAccessMethodTypes() {
    return getAccessMethods().stream().map(AccessMethod::getType).collect(Collectors.toList());
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
  default boolean shouldFetchFenceAccessToken(
      AccessMethodTypeEnum accessMethodType,
      List<String> requestedFields,
      boolean useFallbackAuth,
      boolean forceAccessUrl) {
    return getBondProvider() != null
        && Fields.overlap(requestedFields, Fields.ACCESS_ID_FIELDS)
        && (forceAccessUrl
            || getAccessMethods().stream()
                .anyMatch(
                    m -> {
                      var accessMethodTypeMatches = m.getType().equals(accessMethodType);
                      var validFallbackAuth =
                          !useFallbackAuth
                              || m.getFallbackAuth().orElse(null) == AccessUrlAuthEnum.fence_token;
                      var validAccessAuth =
                          useFallbackAuth || m.getAuth() == AccessUrlAuthEnum.fence_token;

                      return accessMethodTypeMatches
                          && validFallbackAuth
                          && validAccessAuth
                          && m.isFetchAccessUrl();
                    }));
  }

  /** Should Martha call the DRS provider's `access` endpoint to get a signed URL. */
  default boolean shouldFetchAccessUrl(
      AccessMethodTypeEnum accessMethodType, List<String> requestedFields, boolean forceAccessUrl) {
    return Fields.overlap(requestedFields, Fields.ACCESS_ID_FIELDS)
        && (forceAccessUrl
            || getAccessMethods().stream()
                .anyMatch(m -> m.getType().equals(accessMethodType) && m.isFetchAccessUrl()));
  }

  /**
   * Should Martha fetch the Google user service account from Bond. Because this account is
   * Google-specific it should not be fetched if we know the underlying data is not GCS-based.
   */
  default boolean shouldFetchUserServiceAccount(
      AccessMethodTypeEnum accessMethodType, List<String> requestedFields) {
    // This account would be stored in Bond so no Bond means no account.
    return getBondProvider() != null
        // "Not definitely not GCS". A falsy accessMethod is okay because there may not have been a
        // preceding metadata request to determine the accessMethod.
        && (accessMethodType == null || accessMethodType == AccessMethodTypeEnum.gcs)
        && getAccessMethodTypes().contains(AccessMethodTypeEnum.gcs)
        && Fields.overlap(requestedFields, Fields.BOND_SA_FIELDS);
  }

  default boolean shouldFetchPassports(
      AccessMethodTypeEnum accessMethodType, List<String> requestedFields) {
    return Fields.overlap(requestedFields, Fields.ACCESS_ID_FIELDS)
        && getAccessMethods().stream()
            .anyMatch(
                m -> m.getType() == accessMethodType && m.getAuth() == AccessUrlAuthEnum.passport);
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
  default boolean shouldFailOnAccessUrlFail(AccessMethodTypeEnum accessMethodType) {
    return accessMethodType != AccessMethodTypeEnum.gcs;
  }

  default boolean shouldRequestMetadata(List<String> requestedFields) {
    return Fields.overlap(requestedFields, Fields.METADATA_FIELDS);
  }
}
