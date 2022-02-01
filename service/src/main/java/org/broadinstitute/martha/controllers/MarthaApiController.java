package org.broadinstitute.martha.controllers;

import java.util.Objects;
import javax.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.broadinstitute.martha.MarthaException;
import org.broadinstitute.martha.generated.api.MarthaApi;
import org.broadinstitute.martha.generated.model.RequestObject;
import org.broadinstitute.martha.generated.model.ResourceMetadata;
import org.broadinstitute.martha.services.MetadataService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;

@Controller
@Slf4j
public class MarthaApiController implements MarthaApi {

  private final HttpServletRequest request;

  public MarthaApiController(HttpServletRequest request) {
    this.request = request;
  }

  @Override
  public ResponseEntity<ResourceMetadata> getFile(RequestObject body) {
    var userAgent = request.getHeader("user-agent");
    var forceAccessUrl = Objects.equals(request.getHeader("martha-force-access-url"), "true");
    var ip = request.getHeader("X-Forwarded-For");

    if (body == null || body.getUrl() == null) {
      throw new MarthaException("Missing url in request body");
    }

    log.info("Received URL '{}' from agent '{}' on IP '{}'", body.getUrl(), userAgent, ip);

    new MetadataService(body.getUrl(), body.getFields(), null, forceAccessUrl).fetchResourceMetadata();

    return ResponseEntity.ok().build();
  }
}
