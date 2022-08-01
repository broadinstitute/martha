const sinon = require('sinon');

const {
    MARTHA_V3_ALL_FIELDS,
} = require("../../martha/martha_fields");


const mockRequest = (req, options={}, auth="Bearer XYZ_TerraAuthToken") => {
    const forceAccessUrl = Boolean(options.forceAccessUrl || false);
    req.method = 'POST';
    req.headers = { 'authorization': auth, 'martha-force-access-url': forceAccessUrl.toString() };
    if (req.body && typeof req.body.fields === "undefined") {
        req.body.fields = MARTHA_V3_ALL_FIELDS;
    }
    return req;
};

const mockResponse = () => {
    return {
        status(s) {
            this.statusCode = s;
            return this;
        },
        send: sinon.mock('send').once().callsFake(function setBody(body) {
            // Express will effectively JSON.stringify objects passed to send, which is perfect for
            // sending over the wire and deserializing into a simple object on the other end.
            // We want a similar effect here, where all we get are the object properties (and
            // specifically no class instance details) so that we can make comparisons against
            // simple objects. Specifically, this takes care of cases where we "send" a
            // FailureResponse.
            this.body = { ...body };
            return this;
        }),
        setHeader: sinon.stub()
    };
};

function mockGcsAccessUrl(gsUrlString, sig="ABC") {
  const gsUrl = new URL(gsUrlString);
  return {
    url: `https://storage.googleapis.com/${gsUrl.hostname}${gsUrl.pathname}?sig=${sig}`,
  };
}

function drsUrls(host, id, accessId) {
    const objectsUrl = `https://${host}/ga4gh/drs/v1/objects/${id}`;
    return {
        objectsUrl,
        accessUrl: `${objectsUrl}/access/${accessId}`
    };
};

module.exports = {
  mockRequest,
  mockResponse,
  mockGcsAccessUrl,
  drsUrls,
}