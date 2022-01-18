package org.broadinstitute.martha.services;

import java.util.List;
import java.util.Map;

public class MetadataService {
  String url;
  List<String> requestedFields;
  String auth;
  Boolean forceAccessUrl;

  public MetadataService(
      String url, List<String> requestedFields, String auth, Boolean forceAccessUrl) {

    this.url = url;
    this.requestedFields = requestedFields;
    this.auth = auth;
    this.forceAccessUrl = forceAccessUrl;
  }

  public Map<String, String> buildRequest() {

    return null;
  }
}
