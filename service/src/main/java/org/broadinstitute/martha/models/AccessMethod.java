package org.broadinstitute.martha.models;

import java.util.Optional;
import org.immutables.value.Value;

@Value.Immutable
public interface AccessMethod extends WithAccessMethod {
  AccessMethodTypeEnum getAccessMethodType();

  AccessUrlAuthEnum getAccessUrlAuth();

  boolean isFetchAccessUrl();

  Optional<AccessUrlAuthEnum> getFallbackAccessUrlAuth();

  class Builder extends ImmutableAccessMethod.Builder {}
}
