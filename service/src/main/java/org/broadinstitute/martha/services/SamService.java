package org.broadinstitute.martha.services;

import org.broadinstitute.dsde.workbench.client.sam.ApiClient;
import org.broadinstitute.dsde.workbench.client.sam.api.UsersApi;
import org.broadinstitute.martha.config.MarthaConfig;
import org.springframework.stereotype.Service;

@Service
public class SamService {
  private final MarthaConfig marthaConfig;

  public SamService(MarthaConfig marthaConfig) {
    this.marthaConfig = marthaConfig;
  }

  public UsersApi samUsersApi(String accessToken) {
    var client = new ApiClient();
    client.setAccessToken(accessToken);
    return new UsersApi(client.setBasePath(this.marthaConfig.getHosts().get("samBaseUrl")));
  }
}
