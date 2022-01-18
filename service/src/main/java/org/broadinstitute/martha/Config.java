package org.broadinstitute.martha;

import java.util.Map;

public class Config {

  private String currentEnv;

  public final String ENV_MOCK = "mock";
  public final String ENV_DEV = "dev";
  public final String ENV_PROD = "prod";
  public final String ENV_CROMWELL_DEV = "cromwell-dev";

  public final String HOST_MOCK_DRS = "wb-mock-drs-dev.storage.googleapis.com";
  public final String HOST_BIODATA_CATALYST_PROD = "gen3.biodatacatalyst.nhlbi.nih.gov";
  public final String HOST_BIODATA_CATALYST_STAGING = "staging.gen3.biodatacatalyst.nhlbi.nih.gov";
  public final String HOST_CRDC_PROD = "nci-crdc.datacommons.io";
  public final String HOST_CRDC_STAGING = "nci-crdc-staging.datacommons.io";
  public final String HOST_KIDS_FIRST_PROD = "data.kidsfirstdrc.org";
  public final String HOST_KIDS_FIRST_STAGING = "gen3staging.kidsfirstdrc.org";
  public final String HOST_TDR_DEV = "jade.datarepo-dev.broadinstitute.org";
  public final String HOST_THE_ANVIL_PROD = "gen3.theanvil.io";
  public final String HOST_THE_ANVIL_STAGING = "staging.theanvil.io";

  private String terraEnvFrom(String marthaEnv) {
    var lowerMarthaEnv = marthaEnv.toLowerCase();
    switch (lowerMarthaEnv) {
      case ENV_MOCK:
      case ENV_CROMWELL_DEV:
      case ENV_DEV:
        return ENV_DEV;
      default:
        return lowerMarthaEnv;
    }
  }

  /**
   * Return a configuration object with default values for the specified Martha and DSDE
   * environments.
   *
   * @param marthaEnv {string} Martha environment (mock, dev, prod etc.)
   * @param dsdeEnv {string} The DSDE environment (qa, staging, dev, prod etc.)
   * @return {{theAnvilHost: (string), crdcHost: (string), kidsFirstHost: (string), bondBaseUrl:
   *     string, itMarthaBaseUrl: string, itBondBaseUrl: string, samBaseUrl: string,
   *     bioDataCatalystHost: (string)}}
   */
  private Map<String, String> defaultsForEnv(String marthaEnv, String dsdeEnv) {

    return Map.of(
        "theAnvilHost", "",
        "crdcHost", "",
        "kidsFirstHost", "",
        "bondBaseUrl", "",
        "itMarthaBaseUrl", "",
        "itBondBaseUrl", "",
        "samBaseUrl", "",
        "bioDataCatalystHost", "");
  }
}
