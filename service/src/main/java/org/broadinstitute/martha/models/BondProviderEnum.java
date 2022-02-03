package org.broadinstitute.martha.models;

public enum BondProviderEnum {
  DCF_FENCE("dcf-fence"),
  FENCE("fence"),
  ANVIL("anvil"),
  KIDS_FIRST("kids-first");

  public final String label;

  BondProviderEnum(String label) {
    this.label = label;
  }
}
