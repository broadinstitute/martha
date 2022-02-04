package org.broadinstitute.martha.services;

import bio.terra.common.exception.BadRequestException;
import io.github.ga4gh.drs.api.ObjectsApi;
import io.github.ga4gh.drs.client.ApiClient;
import io.github.ga4gh.drs.client.ApiException;
import io.github.ga4gh.drs.model.AccessURL;
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
import org.springframework.stereotype.Service;
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
  private final Pattern compactIdRegex =
      Pattern.compile(
          "(?:dos|drs)://(?<host>dg\\.[0-9a-z-]+)(?<separator>[:/])(?<suffix>[^?]*)(?<query>\\?(.*))?",
          Pattern.CASE_INSENSITIVE);

  private final MarthaConfig marthaConfig;

  public MetadataService(MarthaConfig marthaConfig) {
    this.marthaConfig = marthaConfig;
  }

  public ResourceMetadata fetchResourceMetadata(
      String drsUri, List<String> requestedFields, String auth, Boolean forceAccessUrl) {

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

  private Optional<AccessURL> getAccessUrl(
      AccessUrlAuthEnum accessUrlAuth,
      String host,
      UriComponents uriComponents,
      String accessId,
      String accessToken,
      String auth,
      List<String> passports)
      throws ApiException {

    var objectId =
        uriComponents.getPath()
            + Optional.ofNullable(uriComponents.getQuery()).map(s -> "?" + s).orElse("");
    var api = new ObjectsApi(new ApiClient().setBasePath(host));

    switch (accessUrlAuth) {
      case passport:
        if (passports != null && !passports.isEmpty()) {
          try {
            return Optional.ofNullable(
                api.postAccessURL(Map.of("passports", passports), objectId, accessId));
          } catch (ApiException e) {
            log.error(
                "Passport authorized request failed for {} with error {}",
                uriComponents.toUriString(),
                e.getResponseBody());
          }
        }
        // if we made it this far, there are no passports or there was an error using them so return
        // nothing.
        return Optional.empty();
      case current_request:
        api.getApiClient().addDefaultHeader("authorization", auth);
        return Optional.ofNullable(api.getAccessURL(objectId, accessId));
      case fence_token:
        if (accessToken != null) {
          api.getApiClient().addDefaultHeader("authorization", "Bearer " + accessToken);
          return Optional.ofNullable(api.getAccessURL(objectId, accessId));
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
}
