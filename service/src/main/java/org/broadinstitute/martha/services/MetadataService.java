package org.broadinstitute.martha.services;

import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import bio.terra.common.exception.BadRequestException;
import org.broadinstitute.martha.config.MarthaConfig;
import org.broadinstitute.martha.generated.model.ResourceMetadata;
import org.springframework.stereotype.Service;

@Service
public class MetadataService {
  private final MarthaConfig marthaConfig;

  public MetadataService(MarthaConfig marthaConfig) {
    this.marthaConfig = marthaConfig;
  }

  public ResourceMetadata fetchResourceMetadata(String url, List<String> requestedFields, String auth, Boolean forceAccessUrl) {

    return null;
  }

  private UrlParts getHttpsUrlParts(String url) {
    /*
    DOS or DRS schemes are allowed as of AZUL-702
    https://ucsc-cgl.atlassian.net/browse/AZUL-702
     */

    /*
    The many, many forms of Compact Identifier-based (CIB) DRS URIs to W3C/IETF HTTPS URL conversion:
    - https://ga4gh.github.io/data-repository-service-schemas/preview/release/drs-1.1.0/docs/#_compact_identifier_based_drs_uris
    - https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit
    - https://broadworkbench.atlassian.net/browse/BT-4?focusedCommentId=35980
    - etc.

    Note: GA4GH CIB URIs are incompatible with W3C/IETF URIs and the various standard libraries that parse them:
    - https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Definition
    - https://tools.ietf.org/html/rfc3986
    - https://cr.openjdk.java.net/~dfuchs/writeups/updating-uri/
    - etc.

    Additionally, there are previous non-CIB DOS/DRS URIs that *are* compatible with W3C/IETF URIs format too.
    Instead of encoding the `/` in the protocol suffix to `%2F` they seem to pass it through just as a `/` in the
    HTTPS URL.

    If you update *any* of the below be sure to link to the supporting docs and update the comments above!
     */

    // The many different ways a DOS/DRS may be "compact", in the order that the should be tried
//    var cibRegExps = List.of(
//        // Non-W3C CIB DOS/DRS URIs, where the `dg.abcd` appears more than once
//        // ex. drs://dg.1234:dg.1234/object_id?query_string
//        Pattern.compile("(?:dos|drs)://(?<host>dg\\.[0-9a-z-]+)(?<separator>:)\\k<host>/(?<suffix>[^?]*)(?<query>\\?(.*))?", Pattern.CASE_INSENSITIVE),
//        // Non-W3C CIB DOS/DRS URIs, where the `dg.abcd` is only mentioned once
//        // ex. drs://dg.1234:object_id?query_string
//        Pattern.compile("(?:dos|drs)://(?<host>dg\\.[0-9a-z-]+)(?<separator>:)(?<suffix>[^?]*)(?<query>\\?(.*))?", Pattern.CASE_INSENSITIVE),
//        // W3C compatible using a slash separator
//        // ex. drs://dg.1234/object_id?query_string
//        Pattern.compile("(?:dos|drs)://(?<host>dg\\.[0-9a-z-]+)(?<separator>/)(?<suffix>[^?]*)(?<query>\\?(.*))?", Pattern.CASE_INSENSITIVE)
//    );

    var cibRegExp = Pattern.compile("(?:dos|drs)://(?<host>dg\\.[0-9a-z-]+)(?<separator>:|/)(?<suffix>[^?]*)(?<query>\\?(.*))?", Pattern.CASE_INSENSITIVE);


    //var cibRegExp = cibRegExps.stream().filter(pattern -> pattern.matcher(url).matches()).findFirst();

    var cibMatch = cibRegExp.matcher(url);

    if (cibMatch.matches()) {
      String cibHost = cibMatch.group("host");
      return new UrlParts(
          Objects.requireNonNull(marthaConfig.getHosts().get(cibHost), String.format("Unrecognized Compact Identifier Based host [%s]", cibHost)),
          URLEncoder.encode(cibMatch.group("suffix"), StandardCharsets.UTF_8),
          cibMatch.group("query")
        );
    } else {
      // TODO: someone check my logic from here down (we ran out of time for mobbing)
      URL parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (MalformedURLException e) {
        throw new BadRequestException(e.getMessage());
      }
      if (parsedUrl.getHost().isEmpty() || parsedUrl.getPath().isEmpty()) {
        throw new BadRequestException(String.format("[%s] is missing a host and/or a path.", url));
      }
      // TODO: update this return value
      //  (in doing so we may need to add an optional "port" value to the UrlParts class)
      return new UrlParts(parsedUrl.getHost(), "", "");
    }

//    return {
//        httpsUrlHost: parsedUrl.hostname,
//        httpsUrlPort: parsedUrl.port,
//        protocolSuffix: parsedUrl.pathname.slice(1),
//        httpsUrlSearch: parsedUrl.search,
//    };
  }


  class UrlParts {
    String httpsUrlHost;
    String protocolSuffix;
    String httpsUrlSearch;

    public UrlParts(String httpsUrlHost, String protocolSuffix, String httpsUrlSearch) {
      this.httpsUrlHost = httpsUrlHost;
      this.protocolSuffix = protocolSuffix;
      this.httpsUrlSearch = httpsUrlSearch;
    }
  }
}
