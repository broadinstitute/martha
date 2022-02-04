package org.broadinstitute.martha.config;

import java.util.Optional;
import org.broadinstitute.martha.models.AccessMethodTypeEnum;
import org.broadinstitute.martha.models.AccessUrlAuthEnum;
import org.immutables.value.Value;

@Value.Modifiable
@PropertiesInterfaceStyle
public interface AccessMethod {
  AccessMethodTypeEnum getType();

  AccessUrlAuthEnum getAuth();

  boolean isFetchAccessUrl();

  Optional<AccessUrlAuthEnum> getFallbackAuth();
}
