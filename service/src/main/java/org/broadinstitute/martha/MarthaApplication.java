package org.broadinstitute.martha;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.FilterType;

@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan(
    basePackages = {"org.broadinstitute.martha"},
    excludeFilters = @Filter(type = FilterType.ANNOTATION, classes = SpringBootConfiguration.class))
public class MarthaApplication {

  public static void main(String[] args) {
    SpringApplication.run(MarthaApplication.class, args);
  }
}
