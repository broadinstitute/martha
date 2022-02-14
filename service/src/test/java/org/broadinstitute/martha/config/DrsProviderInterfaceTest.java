package org.broadinstitute.martha.config;

import static org.junit.jupiter.api.Assertions.assertFalse;

import io.github.ga4gh.drs.model.AccessMethod.TypeEnum;
import org.broadinstitute.martha.BaseTest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.mock.mockito.MockBean;

public class DrsProviderInterfaceTest extends BaseTest {

  @MockBean private DrsProviderInterface drsProviderInterfaceMock;

  @Test
  void testUseAliasesForLocalizationPathReturnsFalse() throws Exception {
    assertFalse(drsProviderInterfaceMock.useAliasesForLocalizationPath());
  }

  @Test
  void testGetAccessMethodByTypeReturnsCorrectType() throws Exception {
    // TODO: blargh
    var accessMethod = drsProviderInterfaceMock.getAccessMethodByType(TypeEnum.S3);
    System.out.println("_____________________" + accessMethod);
  }

  //  default ProviderAccessMethodConfig getAccessMethodByType(AccessMethod.TypeEnum
  // accessMethodType) {
  //    return getAccessMethodConfigs().stream()
  //        .filter(o -> o.getType().getReturnedEquivalent() == accessMethodType)
  //        .findFirst()
  //        .orElse(null);
  //  }

}
