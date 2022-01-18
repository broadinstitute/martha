package org.broadinstitute.martha.config;

import java.util.Map;
import org.immutables.value.Value;

@Value.Modifiable
@PropertiesInterfaceStyle
public interface MarthaConfigInterface {

  Map<String, String> getHosts();
}
