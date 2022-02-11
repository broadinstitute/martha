package org.broadinstitute.martha.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.ga4gh.drs.model.AccessMethod;
import io.github.ga4gh.drs.model.AccessMethod.TypeEnum;
import org.broadinstitute.martha.BaseTest;
import org.broadinstitute.martha.models.AccessMethodConfigTypeEnum;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.mock.mockito.MockBean;

public class DrsProviderInterfaceTest extends BaseTest {

  @MockBean private DrsProviderInterface drsProviderInterfaceMock;
  @MockBean private ProviderAccessMethodConfig providerAccessMethodConfig;

  @Test
  void testUseAliasesForLocalizationPathReturnsFalse() throws Exception {
    assertFalse(drsProviderInterfaceMock.useAliasesForLocalizationPath());
  }

  @Test
  void testGetAccessMethodByTypeReturnsCorrectType() throws Exception {
    // TODO: fix type mismatch sigh
    verify(drsProviderInterfaceMock.getAccessMethodByType(TypeEnum.S3), TypeEnum.S3);
  }
//  default ProviderAccessMethodConfig getAccessMethodByType(AccessMethod.TypeEnum accessMethodType) {
//    return getAccessMethodConfigs().stream()
//        .filter(o -> o.getType().getReturnedEquivalent() == accessMethodType)
//        .findFirst()
//        .orElse(null);
//  }

}
