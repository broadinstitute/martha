package org.broadinstitute.martha.models;

public class AccessMethod {

  private final String accessMethodType;
  private final String accessUrlAuth;
  private final boolean fetchAccessUrl;
  private final String fallbackAccessUrlAuth;

  AccessMethod(String accessMethodType, String accessUrlAuth, boolean fetchAccessUrl,
      String fallbackAccessUrlAuth) {
    this.accessMethodType = accessMethodType;
    this.accessUrlAuth = accessUrlAuth;
    this.fetchAccessUrl = fetchAccessUrl;
    this.fallbackAccessUrlAuth = fallbackAccessUrlAuth;
  }
  AccessMethod(String accessMethodType, String accessUrlAuth, boolean fetchAccessUrl) {
    this(accessMethodType, accessUrlAuth, fetchAccessUrl, null);
  }

  public String getAccessMethodType() {
    return accessMethodType;
  }

  public String getAccessUrlAuth() {
    return accessUrlAuth;
  }

  public boolean isFetchAccessUrl() {
    return fetchAccessUrl;
  }

  public String getFallbackAccessUrlAuth() {
    return fallbackAccessUrlAuth;
  }

}
