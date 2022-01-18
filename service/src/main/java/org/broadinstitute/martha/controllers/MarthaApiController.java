package org.broadinstitute.martha.controllers;

import bio.terra.common.exception.UnauthorizedException;
import bio.terra.common.iam.BearerTokenParser;
import javax.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.broadinstitute.dsde.workbench.client.sam.ApiException;
import org.broadinstitute.martha.MarthaException;
import org.broadinstitute.martha.generated.api.MarthaApi;
import org.broadinstitute.martha.generated.model.RequestObject;
import org.broadinstitute.martha.generated.model.ResourceMetadata;
import org.broadinstitute.martha.services.MetadataService;
import org.broadinstitute.martha.services.SamService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;

@Controller
@Slf4j
public class MarthaApiController implements MarthaApi {

  private final HttpServletRequest request;
  private final SamService samService;

  public MarthaApiController(HttpServletRequest request, SamService samService) {
    this.request = request;
    this.samService = samService;
  }

  private String getUserIdFromSam() {
    try {
      var header = request.getHeader("authorization");
      if (header == null) {
        throw new UnauthorizedException("User is not authorized");
      }
      var accessToken = BearerTokenParser.parse(header);

      return samService.samUsersApi(accessToken).getUserStatusInfo().getUserSubjectId();
    } catch (ApiException e) {
      throw new MarthaException(
          e,
          e.getCode() == HttpStatus.NOT_FOUND.value()
              ? HttpStatus.FORBIDDEN
              : HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Override
  public ResponseEntity<ResourceMetadata> getFile(RequestObject body) {
    var userAgent = request.getHeader("user-agent");
    var forceAccessUrl = request.getHeader("martha-force-access-url").equalsIgnoreCase("true");
    var ip = request.getHeader("X-Forwarded-For");

    if (body == null || body.getUrl() == null) {
      throw new MarthaException("Missing url in request body");
    }

    log.info("Received URL '{}' from agent '{}' on IP '{}'", body.getUrl(), userAgent, ip);

    new MetadataService(body.getUrl(), body.getFields(), null, forceAccessUrl).buildRequest();

    return ResponseEntity.ok().build();
  }
}