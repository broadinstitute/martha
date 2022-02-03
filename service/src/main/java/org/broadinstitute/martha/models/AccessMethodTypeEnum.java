package org.broadinstitute.martha.models;

public enum AccessMethodTypeEnum {
  GCS("gs"),
  S3("s3"),
  HTTPS("https");

  public final String label;

  AccessMethodTypeEnum(String label) {
    this.label = label;
  }
}
