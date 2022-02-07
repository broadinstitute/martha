package org.broadinstitute.martha.controllers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.broadinstitute.martha.BaseTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
public class MarthaApiControllerTest extends BaseTest {

  @Autowired private MockMvc mvc;

  // martha_v3 doesn't fail when extra data submitted besides a 'url'
  @Test
  void testExtraDataDoesNotExplode() throws Exception {

    var body = "{ url: `dos://${bdc}/123`, pattern: 'gs://', foo: 'bar' }";
    var authHeader = "bearer abc123";
    // var marthaForceAccessUrl = "martha-force-access-url";
    // var forceAccessUrl = false;
    mvc.perform(post("/api/v4", body).header("authorization", authHeader))
        .andExpect(status().isOk());
  }

  // example old martha post request setup
  //  const mockRequest = (req, options = {}) => {
  //    const forceAccessUrl = Boolean(options.forceAccessUrl || false);
  //    req.method = 'POST';
  //    req.headers = { 'authorization': terraAuth, 'martha-force-access-url':
  // forceAccessUrl.toString() };
  //    if (req.body && typeof req.body.fields === "undefined") {
  //      req.body.fields = MARTHA_V3_ALL_FIELDS;
  //    }
  //    return req;
  //  };

  // ECM test
  //  @Test
  //  void testGetStatus() throws Exception {
  //    mvc.perform(get("/status"))
  //        .andExpect(content().json("{\"ok\": true,\"systems\": { \"postgres\": true}}"));
  //  }

  // example of mvc.perform(post)
  //        mvc.perform(
  //  post("/api/oidc/v1/{provider}/oauthcode", inputLinkedAccount.getProviderName())
  //      .header("authorization", "Bearer " + accessToken)
  //                  .param("scopes", scopes)
  //                  .param("redirectUri", redirectUri)
  //                  .param("state", state)
  //                  .param("oauthcode", oauthcode))
  //      .andExpect(status().isOk())
  //      .andExpect(
  //      content()
  //                  .json(
  //      mapper.writeValueAsString(
  //      oidcApiController.getLinkInfoFromLinkedAccount(inputLinkedAccount))));

  // old Martha test
  //  test.serial("martha_v3 doesn't fail when extra data submitted besides a 'url'", async (t) => {
  //    const response = mockResponse();
  //    await marthaV3(
  //        mockRequest({ body: { url: `dos://${bdc}/123`, pattern: 'gs://', foo: 'bar' } }),
  //    response,
  //    );
  //      t.is(response.statusCode, 200);
  //    });

}
