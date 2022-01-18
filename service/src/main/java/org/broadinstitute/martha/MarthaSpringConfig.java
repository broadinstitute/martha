package org.broadinstitute.martha;

import org.broadinstitute.martha.config.MarthaConfig;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Spring configuration class for loading application config and code defined beans. */
@Configuration
@EnableConfigurationProperties
public class MarthaSpringConfig {
  @Bean
  @ConfigurationProperties(value = "martha", ignoreUnknownFields = false)
  public MarthaConfig getMarthaConfig() {
    return MarthaConfig.create();
  }
}
