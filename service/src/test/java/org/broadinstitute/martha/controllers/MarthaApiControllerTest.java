package org.broadinstitute.martha.controllers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;

import org.broadinstitute.martha.BaseTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.result.ContentResultMatchers;

@AutoConfigureMockMvc
public class MarthaApiControllerTest extends BaseTest {

  @Autowired private MockMvc mvc;


  // martha_v3 doesn't fail when extra data submitted besides a 'url'
  @Test
  void testExtraDataDoesNotExplodeMartha() throws Exception {
    var body = "{ url: `dos://${bdc}/123`, pattern: 'gs://', foo: 'bar' }";
    var authHeader = "bearer abc123";
    // var marthaForceAccessUrl = "martha-force-access-url";
    // var forceAccessUrl = false;
    mvc.perform(post("/api/v4", body).header("authorization", authHeader))
        .andExpect(status().isOk());
  }

  //martha_v3 calls no endpoints when no fields are requested
  @Test
  void testMarthaCallsNoEndpointsWithNoFieldsRequested() throws Exception {
    var body = "{ url: `dos://${bdc}/123`, fields: [] }";
    // TODO: should the second be some kind of isEmpty instead of looking for the empty object?
    mvc.perform(post("/api/v4", body)).andExpect(status().isOk()).andExpect(content().json("{}"));
  }

//  test.serial('martha_v3 calls no endpoints when no fields are requested', async (t) => {
//    const response = mockResponse();
//
//    await marthaV3(mockRequest({
//        body: {
//      url: `dos://${bdc}/123`,
//      fields: [],
//    }
//    }), response);
//
//    t.is(response.statusCode, 200);
//    t.deepEqual(response.body, {});
//
//    sinon.assert.callCount(getJsonFromApiStub, 0);
//  });

  //  const mockResponse = () => {
//    return {
//        status(s) {
//        this.statusCode = s;
//    return this;
//        },
//    send: sinon.mock('send').once().callsFake(function setBody(body) {
//      // Express will effectively JSON.stringify objects passed to send, which is perfect for
//      // sending over the wire and deserializing into a simple object on the other end.
//      // We want a similar effect here, where all we get are the object properties (and
//      // specifically no class instance details) so that we can make comparisons against
//      // simple objects. Specifically, this takes care of cases where we "send" a
//      // FailureResponse.
//      this.body = { ...body };
//      return this;
//    }),
//    setHeader: sinon.stub()
//    };
//  };

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
