package org.broadinstitute.martha.models;

import io.github.ga4gh.drs.model.AccessMethod;

public enum AccessMethodConfigTypeEnum {
  gcs(AccessMethod.TypeEnum.GS),
  s3(AccessMethod.TypeEnum.S3),
  https(AccessMethod.TypeEnum.HTTPS);

  private final AccessMethod.TypeEnum returnedEquivalent;

  AccessMethodConfigTypeEnum(AccessMethod.TypeEnum returnedEquivalent) {
    this.returnedEquivalent = returnedEquivalent;
  }

  public AccessMethod.TypeEnum getReturnedEquivalent() {
    return this.returnedEquivalent;
  }
}
