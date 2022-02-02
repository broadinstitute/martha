package org.broadinstitute.martha.controllers;

import bio.terra.common.exception.BadRequestException;
import bio.terra.common.exception.UnauthorizedException;
import java.util.ArrayList;
import java.util.Objects;
import javax.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.broadinstitute.martha.generated.api.MarthaApi;
import org.broadinstitute.martha.generated.model.RequestObject;
import org.broadinstitute.martha.generated.model.ResourceMetadata;
import org.broadinstitute.martha.models.Fields;
import org.broadinstitute.martha.services.MetadataService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;

@Controller
@Slf4j
public class MarthaApiController implements MarthaApi {

  private final HttpServletRequest request;
  private final MetadataService metadataService;

  public MarthaApiController(HttpServletRequest request, MetadataService metadataService) {
    this.request = request;
    this.metadataService = metadataService;
  }

  @Override
  public ResponseEntity<ResourceMetadata> getFile(RequestObject body) {
    var auth = request.getHeader("authorization");

    validateRequest(body, auth);

    var userAgent = request.getHeader("user-agent");
    var forceAccessUrl = Objects.equals(request.getHeader("martha-force-access-url"), "true");
    var ip = request.getHeader("X-Forwarded-For");

    log.info("Received URL '{}' from agent '{}' on IP '{}'", body.getUrl(), userAgent, ip);

    var resourceMetadata =
        metadataService.fetchResourceMetadata(
            body.getUrl(), body.getFields(), auth, forceAccessUrl);

    return ResponseEntity.ok(resourceMetadata);
  }

  private void validateRequest(RequestObject body, String auth) {
    if (auth == null) {
      throw new UnauthorizedException("Authorization header is missing.");
    }
    var errors = new ArrayList<String>();

    if (body == null || body.getUrl() == null) {
      errors.add("Missing url in request body");
    }

    if (body != null
        && body.getFields() != null
        && !Fields.ALL_FIELDS.containsAll(body.getFields())) {
      errors.add(
          String.format("Some fields were not valid. Supported fields are %s", Fields.ALL_FIELDS));
    }

    if (!errors.isEmpty()) {
      throw new BadRequestException(String.join(",", errors));
    }
  }
}
