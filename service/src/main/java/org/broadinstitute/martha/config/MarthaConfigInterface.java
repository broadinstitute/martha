package org.broadinstitute.martha.config;

import java.util.Map;
import org.immutables.value.Value;

@Value.Modifiable
@PropertiesInterfaceStyle
public interface MarthaConfigInterface {

  String getBondUrl();

  String getSamUrl();

  String getExternalcredsUrl();

  Map<String, String> getHosts();

  Map<String, DrsProvider> getDrsProviders();
}
