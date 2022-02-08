package org.broadinstitute.martha.models;

import io.github.ga4gh.drs.model.AccessMethod;

public enum AccessMethodTypeEnum {
  gcs,
  s3,
  https;

  public boolean matchesReturnedMethodType(AccessMethod.TypeEnum m2) {
    return this.toString().equals(m2.getValue());
  }
}
