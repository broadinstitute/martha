package org.broadinstitute.martha;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(classes = MarthaApplication.class)
@ActiveProfiles("human-readable-logging")
public abstract class BaseTest {
  public void assertEmpty(Optional<?> optional) {
    assertTrue(optional.isEmpty(), "expected empty optional");
  }

  public void assertPresent(Optional<?> optional) {
    assertTrue(optional.isPresent(), "expected non-empty optional");
  }
}
