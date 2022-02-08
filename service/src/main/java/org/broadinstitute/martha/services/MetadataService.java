package org.broadinstitute.martha.services;

import bio.terra.bond.api.BondApi;
import bio.terra.common.exception.BadRequestException;
import bio.terra.externalcreds.api.OidcApi;
import io.github.ga4gh.drs.api.ObjectsApi;
import io.github.ga4gh.drs.client.ApiClient;
import io.github.ga4gh.drs.model.AccessMethod;
import io.github.ga4gh.drs.model.AccessURL;
import io.github.ga4gh.drs.model.DrsObject;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.broadinstitute.martha.MarthaException;
import org.broadinstitute.martha.config.DrsProvider;
import org.broadinstitute.martha.config.MarthaConfig;
import org.broadinstitute.martha.generated.model.ResourceMetadata;
import org.broadinstitute.martha.models.AccessUrlAuthEnum;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;

@Service
@Slf4j
public class MetadataService {

  /**
   * DOS or DRS schemes are allowed as of <a
   * href="https://ucsc-cgl.atlassian.net/browse/AZUL-702">AZUL-702</a>
   *
   * <p>The many, many forms of Compact Identifier-based (CIB) DRS URIs to W3C/IETF HTTPS URL
   * conversion:
   *
   * <ul>
   *   <li>https://ga4gh.github.io/data-repository-service-schemas/preview/release/drs-1.1.0/docs/#_compact_identifier_based_drs_uris
   *   <li>https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit
   *   <li>https://broadworkbench.atlassian.net/browse/BT-4?focusedCommentId=35980
   *   <li>etc.
   * </ul>
   *
   * <p>Note: GA4GH CIB URIs are incompatible with W3C/IETF URIs and the various standard libraries
   * that parse them:
   *
   * <ul>
   *   <li>https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Definition
   *   <li>https://tools.ietf.org/html/rfc3986
   *   <li>https://cr.openjdk.java.net/~dfuchs/writeups/updating-uri/
   *   <li>etc.
   * </ul>
   *
   * <p>Additionally, there are previous non-CIB DOS/DRS URIs that *are* compatible with W3C/IETF
   * URIs format too. Instead of encoding the `/` in the protocol suffix to `%2F` they seem to pass
   * it through just as a `/` in the HTTPS URL.
   *
   * <p>If you update *any* of the below be sure to link to the supporting docs and update the
   * comments above!
   */
  private static final Pattern compactIdRegex =
      Pattern.compile(
          "(?:dos|drs)://(?<host>dg\\.[0-9a-z-],)(?<separator>[:/])(?<suffix>[^?]*)(?<query>\\?(.*))?",
          Pattern.CASE_INSENSITIVE);

  private static final String PROTOCOL_PREFIX_DRS = "/ga4gh/drs/v1";
  private static final Pattern accessTokenRegex =
      Pattern.compile("Bearer (?<token>.+)", Pattern.CASE_INSENSITIVE);

  private final MarthaConfig marthaConfig;

  public MetadataService(MarthaConfig marthaConfig) {
    this.marthaConfig = marthaConfig;
  }

  public ResourceMetadata fetchResourceMetadata(
      String drsUri, List<String> requestedFields, String auth, Boolean forceAccessUrl) {

    var accessToken = accessTokenRegex.matcher(auth).group("token");
    var uriComponents = getUriComponents(drsUri);
    var provider = determineDrsProvider(uriComponents);

    log.info(
        "Drs URI '{}' will use provider {}, requested fields {}",
        drsUri,
        provider.getName(),
        String.join(", ", requestedFields));
    return null;
  }

  private UriComponents getUriComponents(String drsUri) {

    var compactIdMatch = compactIdRegex.matcher(drsUri);

    if (compactIdMatch.matches()) {
      String cibHost = compactIdMatch.group("host");

      return UriComponentsBuilder.newInstance()
          .host(
              Objects.requireNonNull(
                  marthaConfig.getHosts().get(cibHost),
                  String.format("Unrecognized Compact Identifier Based host [%s]", cibHost)))
          .path(URLEncoder.encode(compactIdMatch.group("suffix"), StandardCharsets.UTF_8))
          .query(compactIdMatch.group("query"))
          .build();
    } else {
      var parsedUri = UriComponentsBuilder.fromUriString(drsUri).build();
      if (parsedUri.getHost() == null || parsedUri.getPath() == null) {
        throw new BadRequestException(
            String.format("[%s] is missing a host and/or a path.", drsUri));
      }
      return parsedUri;
    }
  }

  private DrsProvider determineDrsProvider(UriComponents uriComponents) {
    var host = uriComponents.getHost();
    assert host != null;

    if (host.endsWith("dataguids.org")) {
      throw new BadRequestException(
          "dataguids.org data has moved. See: https://support.terra.bio/hc/en-us/articles/360060681132");
    }

    var providers = marthaConfig.getDrsProviders().values();

    return providers.stream()
        .filter(p -> host.matches(p.getHostRegex()))
        .findFirst()
        .orElseThrow(
            () ->
                new BadRequestException(
                    String.format(
                        "Could not determine DRS provider for id '%s'",
                        uriComponents.toUriString())));
  }

  private String getObjectId(UriComponents uriComponents) {
    return uriComponents.getPath()
        + Optional.ofNullable(uriComponents.getQuery()).map(s -> "?" + s).orElse("");
  }

  private Optional<AccessURL> getAccessUrl(
      AccessUrlAuthEnum accessUrlAuth,
      String host,
      UriComponents uriComponents,
      String accessId,
      String accessToken,
      String auth,
      List<String> passports)
      throws RestClientException {

    var drsApi = new ObjectsApi(new ApiClient().setBasePath(host + PROTOCOL_PREFIX_DRS));
    var objectId = getObjectId(uriComponents);

    switch (accessUrlAuth) {
      case passport:
        if (passports != null && !passports.isEmpty()) {
          try {
            return Optional.ofNullable(
                drsApi.postAccessURL(Map.of("passports", passports), objectId, accessId));
          } catch (RestClientException e) {
            log.error(
                "Passport authorized request failed for {} with error {}",
                uriComponents.toUriString(),
                e.getMessage());
          }
        }
        // if we made it this far, there are no passports or there was an error using them so return
        // nothing.
        return Optional.empty();
      case current_request:
        drsApi.getApiClient().addDefaultHeader("authorization", auth);
        return Optional.ofNullable(drsApi.getAccessURL(objectId, accessId));
      case fence_token:
        if (accessToken != null) {
          drsApi.getApiClient().addDefaultHeader("authorization", "Bearer " + accessToken);
          return Optional.ofNullable(drsApi.getAccessURL(objectId, accessId));
        } else {
          throw new BadRequestException(
              String.format(
                  "Fence access token required for %s but is missing. Does user have an account linked in Bond?",
                  uriComponents.toUriString()));
        }
      default:
        throw new MarthaException("This should be impossible, unknown auth type");
    }
  }

  private Optional<String> getFenceAccessToken(
      String drsUri,
      Optional<AccessMethod> accessMethod,
      boolean useFallbackAuth,
      DrsProvider drsProvider,
      List<String> requestedFields,
      boolean forceAccessUrl,
      String bearerToken) {
    if (drsProvider.shouldFetchFenceAccessToken(
        accessMethod.map(AccessMethod::getType).orElse(null),
        requestedFields,
        useFallbackAuth,
        forceAccessUrl)) {

      log.info(
          "Requesting Bond access token for '{}' from '{}'", drsUri, drsProvider.getBondProvider());

      var bondApi = new BondApi();
      bondApi.getApiClient().setBasePath(marthaConfig.getBondUrl());
      bondApi.getApiClient().setAccessToken(bearerToken);

      var response = bondApi.getLinkAccessToken(drsProvider.getBondProvider().toString());

      return Optional.ofNullable(response.getToken());
    } else {
      return Optional.empty();
    }
  }

  private String fetchMetadata(
      DrsProvider drsProvider,
      List<String> requestedFields,
      UriComponents uriComponents,
      String drsUri,
      boolean sendMetadataAuth,
      String bearerToken,
      boolean useFallbackAuth,
      boolean forceAccessField) {
    DrsObject drsResponse = null;
    if (drsProvider.shouldRequestMetadata(requestedFields)) {

      var objectId = getObjectId(uriComponents);
      log.info(
          "Requesting DRS metadata for '{}' with auth required '{}'", drsUri, sendMetadataAuth);

      var drsApi = buildDrsApi(uriComponents);
      if (sendMetadataAuth) {
        drsApi.getApiClient().setAccessToken(bearerToken);
      }

      drsResponse = drsApi.getObject(objectId, false);
    }

    var accessMethod = getAccessMethod(drsResponse, drsProvider);
    // TODO: make this optional instead of icky null
    var accessMethodType = accessMethod.map(AccessMethod::getType).orElse(null);

    String bondSaKey = null;
    if (drsProvider.shouldFetchUserServiceAccount(accessMethodType, requestedFields)) {
      var bondApi = new BondApi();
      bondApi.getApiClient().setBasePath(marthaConfig.getBondUrl());
      bondApi.getApiClient().setAccessToken(bearerToken);

      // TODO: are we getting the key in a usable format?
      bondSaKey =
          bondApi.getLinkSaKey(drsProvider.getBondProvider().toString()).getData().toString();
    }

    List<String> passports = null;
    // TODO: is this an else-if?
    if (drsProvider.shouldFetchPassports(accessMethodType, requestedFields)) {

      var ecmApi = new OidcApi();
      ecmApi.getApiClient().setBasePath(marthaConfig.getExternalcredsUrl());
      ecmApi.getApiClient().setAccessToken(bearerToken);

      try {
        // For now, we are only getting a RAS passport. In the future it may also fetch from other
        // providers.
        passports = List.of(ecmApi.getProviderPassport("ras"));
      } catch (HttpStatusCodeException e) {
        if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
          log.info("User does not have a passport.");
        } else {
          throw e;
        }
      }
    }

    var fileName = getDrsFileName(drsResponse);
    var localizationPath = getLocalizationPath(drsProvider, drsResponse);

    try {
      var accessToken =
          getFenceAccessToken(
              drsUri,
              accessMethod,
              useFallbackAuth,
              drsProvider,
              requestedFields,
              forceAccessField,
              bearerToken);

      if (drsProvider.shouldFetchAccessUrl(accessMethodType, requestedFields, forceAccessField)) {
        // TODO: leaving off here. there are more fields in the generated accessMethod class than in
        // ours, maybe we should just use it.
        //        var accessUrl = generateAccessUrl(drsProvider, uriComponents,
        //            drsResponse.getAccessMethods().get())
      }
    } catch (RestClientException e) {
      e.printStackTrace();
    }

    return null;
  }

  private ObjectsApi buildDrsApi(UriComponents uriComponents) {
    var basePathComponents =
        UriComponentsBuilder.newInstance()
            .scheme("https")
            .host(uriComponents.getHost())
            .port(uriComponents.getPort())
            .path(PROTOCOL_PREFIX_DRS)
            .build();

    return new ObjectsApi(new ApiClient().setBasePath(basePathComponents.toUriString()));
  }

  private Optional<AccessMethod> getAccessMethod(DrsObject drsResponse, DrsProvider drsProvider) {
    if (drsResponse != null && !drsResponse.getAccessMethods().isEmpty()) {
      for (var methodConfig : drsProvider.getAccessMethodConfigs()) {
        var matchingMethod =
            drsResponse.getAccessMethods().stream()
                .filter(m -> m.getType().getValue().equals(methodConfig.getType().toString()))
                .findFirst();
        if (matchingMethod.isPresent()) {
          return matchingMethod;
        }
      }
    }
    return Optional.empty();
  }

  /**
   * Attempts to return the file name using only the drsResponse.
   *
   * <p>It is possible the name may need to be retrieved from the signed url.
   */
  private Optional<String> getDrsFileName(DrsObject drsResponse) {
    if (drsResponse == null) {
      return Optional.empty();
    }

    if (drsResponse.getName() != null) {
      return Optional.of(drsResponse.getName());
    }

    var accessURL = drsResponse.getAccessMethods().get(0).getAccessUrl();

    if (accessURL != null) {
      var path = URI.create(accessURL.getUrl()).getPath();
      return Optional.ofNullable(path).map(s -> s.replaceAll("^.*[\\\\/]", ""));
    }

    return Optional.empty();
  }

  private Optional<String> getLocalizationPath(DrsProvider drsProvider, DrsObject drsResponse) {
    if (drsProvider.useAliasesForLocalizationPath()
        && drsResponse != null
        && drsResponse.getAliases() != null
        && !drsResponse.getAliases().isEmpty()) {
      return Optional.of(drsResponse.getAliases().get(0));
    }

    return Optional.empty();
  }
}
