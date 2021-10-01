/**
 * When writing/testing GCF functions, see:
 * - https://cloud.google.com/functions/docs/monitoring/error-reporting
 * - https://cloud.google.com/functions/docs/bestpractices/testing
 *
 * NOTE: Any tests in this file that rely on the before/after stubs need to be run sequentially, see:
 * https://github.com/avajs/ava/issues/1066
 */

const {
    sampleDosResponse,
    sampleDosMarthaResult,
    jadeDrsResponse,
    jadeDrsMarthaResult,
    hcaDrsMarthaResult,
    hcaDrsResponse,
    bdcDrsMarthaResult,
    bdcDrsResponse,
    bdcDrsResponseCustom,
    kidsFirstDrsResponse,
    kidsFirstDrsResponseCustom,
    kidsFirstDrsMarthaResult,
    anvilDrsMarthaResult,
    anvilDrsResponse,
    gen3CrdcDrsMarthaResult,
    gen3CrdcResponse,
    pdcDrsMarthaResult,
    pdcResponse,
    dosObjectWithMissingFields,
    dosObjectWithInvalidFields,
    drsObjectWithInvalidFields,
    expectedObjWithMissingFields,
} = require('./_martha_v3_resources.js');

const test = require('ava');
const sinon = require('sinon');
const {
    marthaV3Handler: marthaV3,
    DrsProvider,
    determineDrsProvider,
    generateMetadataUrl,
    generateAccessUrl,
    getHttpsUrlParts,
    MARTHA_V3_ALL_FIELDS,
    overridePencilsDownSeconds,
    PROTOCOL_PREFIX_DRS
} = require('../../martha/martha_v3');
const apiAdapter = require('../../common/api_adapter');
const config = require('../../common/config');
const { delay } = require('../../common/helpers');
const mask = require('json-mask');

const terraAuth = 'bearer abc123';

const mockRequest = (req, requestFields = MARTHA_V3_ALL_FIELDS) => {
    req.method = 'POST';
    req.headers = { authorization: terraAuth };
    if (req.body && typeof req.body.fields === "undefined") {
        req.body.fields = requestFields;
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

const googleSAKeyObject = { key: 'A Google Service Account private key json object' };

const bondAccessTokenResponse = {
    token: 'my-fake-token',
    expires_at: 'NEVER'
};

const bondUrls = (provider) => {
    const baseUrl = `https://broad-bond-dev.appspot.com/api/link/v1/${provider}`;
    return {
        serviceAccountKeyUrl: `${baseUrl}/serviceaccount/key`,
        accessTokenUrl: `${baseUrl}/accesstoken`
    };
};

const drsUrls = (host, id, accessId) => {
    const objectsUrl = `https://${host}/ga4gh/drs/v1/objects/${id}`;
    return {
        objectsUrl,
        accessUrl: `${objectsUrl}/access/${accessId}`
    };
};

// This will not be unused when we eventually turn on signed URLs for a dataset hosted in GCS.
// eslint-disable-next-line no-unused-vars
function mockGcsAccessUrl(gsUrlString) {
    const gsUrl = new URL(gsUrlString);
    return { url: `https://storage.googleapis.com/${gsUrl.hostname}${gsUrl.pathname}?sig=ABC` };
}

function mockS3AccessUrl(s3UrlString) {
    const s3Url = new URL(s3UrlString);
    return { url: `https://${s3Url.hostname}.s3-website.us-west-2.amazonaws.com${s3Url.pathname}?sig=ABC` };
}

const bdc = config.HOST_BIODATA_CATALYST_STAGING;
const crdc = config.HOST_CRDC_STAGING;
const kidsFirst = config.HOST_KIDS_FIRST_STAGING;

let getJsonFromApiStub;
const getJsonFromApiMethodName = 'getJsonFrom';

test.serial.beforeEach(() => {
    sinon.restore(); // If one test fails, the .afterEach() block will not execute, so always clean the slate here
    getJsonFromApiStub = sinon.stub(apiAdapter, getJsonFromApiMethodName);
});

test.serial.afterEach(() => {
    sinon.restore();
});

test.serial('martha_v3 uses the default error handler for unexpected errors', async (t) => {
    const expectedError = new Error('Expected test error');
    const badReq = { get headers() { throw expectedError; } };
    const response = mockResponse();
    const actualError = await t.throwsAsync(marthaV3(badReq, response));
    t.is(actualError, expectedError);
    sinon.assert.callCount(response.send, 0);
});

// According to the DRS specification authors [0] it's OK for a client to call Martha with a `drs://` URI and get
// back a DOS object. Martha should just "do the right thing" and return whichever format the server supports,
// instead of erroring out with a 404 due the URI not being found [1].
//
// [0] https://ucsc-cgl.atlassian.net/browse/AZUL-702
// [1] https://broadinstitute.slack.com/archives/G011ZUKHCUX/p1597694952108600
test.serial('martha_v3 resolves a valid DRS-style url', async (t) => {
    const bond = bondUrls('dcf-fence');
    const drs = drsUrls(crdc, '123');
    getJsonFromApiStub.withArgs(bond.serviceAccountKeyUrl, terraAuth).resolves(googleSAKeyObject);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(sampleDosResponse);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': `drs://${crdc}/123` } }), response);

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, sampleDosMarthaResult(googleSAKeyObject));

    sinon.assert.callCount(getJsonFromApiStub, 2);
});

test.serial("martha_v3 doesn't fail when extra data submitted besides a 'url'", async (t) => {
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { url: `dos://${bdc}/123`, pattern: 'gs://', foo: 'bar' } }),
        response,
    );
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 does not call Bond when only DRS fields are requested', async (t) => {
    const drs = drsUrls(bdc, '123');
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(sampleDosResponse);
    const response = mockResponse();

    await marthaV3(mockRequest({
        body: {
            url: `dos://${bdc}/123`,
            fields: ['gsUri', 'size', 'hashes', 'timeUpdated', 'fileName'],
        },
    }), response);

    t.is(response.statusCode, 200);
    t.deepEqual(
        response.body,
        mask(sampleDosMarthaResult(googleSAKeyObject), 'gsUri,size,hashes,timeUpdated,fileName'),
    );

    sinon.assert.callCount(getJsonFromApiStub, 1);
});

test.serial('martha_v3 does not call anything when only a `googleServiceAccount` is requested for Kids First', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({
        body: {
            url: `drs://${kidsFirst}/123`,
            fields: ['googleServiceAccount'],
        },
    }), response);

    t.is(response.statusCode, 200);
    t.deepEqual(
        response.body,
        { googleServiceAccount: null }
    );

    sinon.assert.callCount(getJsonFromApiStub, 0);
});

test.serial('martha_v3 calls the correct endpoints if the googleServiceAccount is requested', async (t) => {
    const bond = bondUrls('dcf-fence');
    getJsonFromApiStub.withArgs(bond.serviceAccountKeyUrl, terraAuth).resolves(googleSAKeyObject);
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { url: `dos://${crdc}/123`, fields: ['googleServiceAccount'] } }),
        response
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, mask(sampleDosMarthaResult(googleSAKeyObject), 'googleServiceAccount'));

    sinon.assert.callCount(getJsonFromApiStub, 1);
});

test.serial('martha_v3 calls the correct endpoints when only the accessUrl is requested', async (t) => {
    const {
        id: objectId, self_uri: drsUri,
        access_methods: { 0: { access_id: accessId, access_url: { url: s3Url } } }
    } = kidsFirstDrsResponse;
    const bond = bondUrls('kids-first');
    const drs = drsUrls(config.HOST_KIDS_FIRST_STAGING, objectId, accessId);
    const drsAccessUrlResponse = mockS3AccessUrl(s3Url);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(kidsFirstDrsResponse);
    getJsonFromApiStub.withArgs(bond.accessTokenUrl, terraAuth).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.withArgs(drs.accessUrl, `Bearer ${bondAccessTokenResponse.token}`)
        .resolves(drsAccessUrlResponse);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { url: drsUri, fields: ['accessUrl'] } }), response);

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, { accessUrl: drsAccessUrlResponse });

    sinon.assert.callCount(getJsonFromApiStub, 3);
});

test.serial('martha_v3 calls the correct endpoints when only the fileName is requested and the metadata contains a name', async (t) => {
    const fileName = 'HG01131.final.cram.crai';
    const drsResponse = bdcDrsResponseCustom({
        name: fileName,
        access_url: { url: bdcDrsResponse.access_methods[0].access_url.url },
        access_id: bdcDrsResponse.access_methods[0].access_id,
    });
    const { id: objectId, self_uri: drsUri } = drsResponse;
    const drs = drsUrls(config.HOST_BIODATA_CATALYST_STAGING, objectId);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(drsResponse);
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { url: drsUri, fields: ['fileName'] } }),
        response,
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, { fileName });

    sinon.assert.callCount(getJsonFromApiStub, 1);
});

test.serial('martha_v3 calls the correct endpoints when only the fileName is requested and the metadata contains only an access id', async (t) => {
    const {
        id: objectId, self_uri: drsUri,
        access_methods: { 0: { access_id: accessId } }
    } = kidsFirstDrsResponse;
    const drs = drsUrls(config.HOST_KIDS_FIRST_STAGING, objectId, accessId);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null)
        .resolves(kidsFirstDrsResponseCustom({ name: null, access_url: { url: null } }));
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { url: drsUri, fields: ['fileName'] } }),
        response,
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, { fileName: null });

    sinon.assert.callCount(getJsonFromApiStub, 1);
});

test.serial('martha_v3 calls return the DRS name field for a file name even when it differs from the access url', async (t) => {
    const {
        id: objectId, self_uri: drsUri,
        access_methods: { 0: { access_id: accessId, access_url: { url: s3Url } } },
    } = kidsFirstDrsResponse;
    const bond = bondUrls('kids-first');
    const drs = drsUrls(config.HOST_KIDS_FIRST_STAGING, objectId, accessId);
    const drsAccessUrlResponse = mockS3AccessUrl(s3Url);
    const fileName = 'from_name_field.txt';
    getJsonFromApiStub.withArgs(drs.objectsUrl, null)
        .resolves(kidsFirstDrsResponseCustom({ name: fileName, access_url: { url: null } }));
    getJsonFromApiStub.withArgs(bond.accessTokenUrl, terraAuth).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.withArgs(drs.accessUrl, `Bearer ${bondAccessTokenResponse.token}`)
        .resolves(drsAccessUrlResponse);
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { url: drsUri, fields: ['fileName', 'accessUrl'] } }),
        response
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, { accessUrl: drsAccessUrlResponse, fileName });

    sinon.assert.callCount(getJsonFromApiStub, 3);
});

test.serial('martha_v3 calls no endpoints when no fields are requested', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({
        body: {
            url: `dos://${bdc}/123`,
            fields: [],
        }
    }), response);

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, {});

    sinon.assert.callCount(getJsonFromApiStub, 0);
});

test.serial('martha_v3 returns an error when fields is not an array', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            fields: 'gsUri',
        }
    }), response);

    t.is(response.statusCode, 400);
    t.deepEqual(
        response.body,
        {
            response: {
                status: 400,
                text: "Request is invalid. 'fields' was not an array.",
            },
            status: 400,
        },
    );

    sinon.assert.callCount(getJsonFromApiStub, 0);
});

test.serial('martha_v3 returns an error when an invalid field is requested', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            fields: ['gsUri', 'size', 'hashes', 'timeUpdated', 'fileName', 'googleServiceAccount', 'meaningOfLife'],
        }
    }), response);

    t.is(response.statusCode, 400);
    t.deepEqual(
        response.body,
        {
            response: {
                status: 400,
                text:
                    "Request is invalid. Fields 'meaningOfLife' are not supported. Supported fields are " +
                    "'gsUri', 'bucket', 'name', 'fileName', 'contentType', 'size', 'hashes', " +
                    "'timeCreated', 'timeUpdated', 'googleServiceAccount', 'bondProvider', 'accessUrl'.",
            },
            status: 400,
        },
    );

    sinon.assert.callCount(getJsonFromApiStub, 0);
});

test.serial('martha_v3 should return 400 if a Data Object without authorization header is provided', async (t) => {
    const response = mockResponse();
    const mockReq = mockRequest({ body: { 'url': 'dos://abc/123' } });
    delete mockReq.headers.authorization;

    await marthaV3(mockReq, response);

    t.is(response.statusCode, 400);
    t.is(response.body.status, 400);
    t.is(response.body.response.text, 'Request is invalid. Authorization header is missing.');
});

test.serial('martha_v3 should return 400 if not given a url', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'uri': 'dos://abc/123' } }), response);

    t.is(response.statusCode, 400);
    t.is(response.body.status, 400);
    t.is(response.body.response.text, "Request is invalid. 'url' is missing.");
});

test.serial('martha_v3 should return 400 if given a dg URL without a path', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': 'dos://dg.abc' } }), response);

    t.is(response.statusCode, 400);
    t.is(response.body.status, 400);
    t.is(response.body.response.text, 'Request is invalid. "dos://dg.abc" is missing a host and/or a path.');
});

test.serial('martha_v3 should return 400 if given a dg URL with only a path', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': 'dos:///dg.abc' } }), response);

    t.is(response.statusCode, 400);
    t.is(response.body.status, 400);
    t.is(response.body.response.text, 'Request is invalid. "dos:///dg.abc" is missing a host and/or a path.');
});

test.serial('martha_v3 should return 400 if no data is posted with the request', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({}), response);

    t.is(response.statusCode, 400);
    t.is(response.body.status, 400);
    t.is(response.body.response.text, "Request is invalid. 'url' is missing.");
});

test.serial('martha_v3 should return 400 if given a \'url\' with an invalid value', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { url: 'Not a valid URI' } }), response);

    t.is(response.statusCode, 400);
    t.is(response.body.status, 400);
    t.is(response.body.response.text, 'Request is invalid. Invalid URL: Not a valid URI');
});

test.serial('martha_v3 should return 500 if Data Object resolution fails', async (t) => {
    const drs = drsUrls(bdc, '123');
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).rejects(new Error('Data Object Resolution forced to fail by testing stub'));
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': `dos://${bdc}/123` } }), response);

    t.is(response.statusCode, 500);
    t.is(response.body.status, 500);
    t.is(response.body.response.text, 'Received error while resolving DRS URL. Data Object Resolution forced to fail by testing stub');
});

test.serial('martha_v3 should return the underlying status if Data Object resolution fails', async (t) => {
    const drs = drsUrls(bdc, '123');
    const error = new Error('Data Object Resolution forced to fail by testing stub');
    error.status = 418;
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).rejects(error);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': `dos://${bdc}/123` } }), response);

    t.is(response.statusCode, 418);
    t.is(response.body.status, 418);
    t.is(
        response.body.response.text,
        'Received error while resolving DRS URL. Data Object Resolution forced to fail by testing stub',
    );
});

test.serial('martha_v3 should return 500 if key retrieval from Bond fails', async (t) => {
    const bond = bondUrls('dcf-fence');
    const drs = drsUrls(crdc, '123');
    getJsonFromApiStub.withArgs(bond.serviceAccountKeyUrl, terraAuth).rejects(new Error('Bond key lookup forced to fail by testing stub'));
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(sampleDosResponse);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': `dos://${crdc}/123` } }), response);

    t.is(response.statusCode, 500);
    t.is(response.body.status, 500);
    t.is(response.body.response.text, 'Received error contacting Bond. Bond key lookup forced to fail by testing stub');
});

test.serial('martha_v3 calls Bond with the "fence" provider when the Data Object URL host is "dg.4503"', async (t) => {
    const bond = bondUrls('fence');
    const drs = drsUrls(config.HOST_BIODATA_CATALYST_STAGING);
    getJsonFromApiStub.withArgs(bond.serviceAccountKeyUrl, terraAuth).resolves(googleSAKeyObject);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(bdcDrsResponse);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': 'drs://dg.4503/this_part_can_be_anything' } }), response);

    t.is(response.statusCode, 200); // Not strictly necessary here, but the test fails if we don't assert something
    sinon.assert.callCount(getJsonFromApiStub, 2);
});

test.serial('martha_v3 does call Bond and return SA key when the host url is for dataguids.org', async (t) => {
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { 'url': 'dos://dataguids.org/a41b0c4f-ebfb-4277-a941-507340dea85d' } }),
        response
    );

    t.is(response.statusCode, 400);
    t.is(response.body.response.text,
        'Request is invalid. dataguids.org data has moved. See: https://support.terra.bio/hc/en-us/articles/360060681132'
    );

    sinon.assert.callCount(getJsonFromApiStub, 0);
});

test.serial('martha_v3 does not call Bond or return SA key when the host url is for jade data repo', async (t) => {
    const drs = drsUrls('jade.datarepo-dev.broadinstitute.org', 'abc');
    getJsonFromApiStub.withArgs(drs.objectsUrl, terraAuth).resolves(jadeDrsResponse);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': 'drs://jade.datarepo-dev.broadinstitute.org/abc' } }), response);

    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    t.deepEqual(response.body, jadeDrsMarthaResult);
    t.falsy(result.googleServiceAccount);

    sinon.assert.callCount(getJsonFromApiStub, 1);
});

test.serial('martha_v3 parses Gen3 CRDC response correctly', async (t) => {
    const bond = bondUrls('dcf-fence');
    const drs = drsUrls(config.HOST_CRDC_STAGING, '206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc');
    getJsonFromApiStub.withArgs(bond.serviceAccountKeyUrl, terraAuth).resolves(googleSAKeyObject);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(gen3CrdcResponse);
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { 'url': `dos://${config.HOST_CRDC_STAGING}/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc` } }),
        response,
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, gen3CrdcDrsMarthaResult(googleSAKeyObject, null));

    sinon.assert.callCount(getJsonFromApiStub, 2);
});

test.serial('martha_v3 parses a Gen3 CRDC CIB URI response correctly', async (t) => {
    const bond = bondUrls('dcf-fence');
    // TODO: This object ID is inconsistent with gen3CrdcResponse but, for now, it doesn't break
    // anything. Eventually, when we turn on signed URLs for CRDC, we may want to reconcile the
    // difference so that we can avoid duplication of these IDs between the tests and test data.
    const drs = drsUrls(config.HOST_CRDC_STAGING, '206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc');
    getJsonFromApiStub.withArgs(bond.serviceAccountKeyUrl, terraAuth).resolves(googleSAKeyObject);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(gen3CrdcResponse);
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { 'url': 'dos://dg.4DFC:206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc' } }),
        response,
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, gen3CrdcDrsMarthaResult(googleSAKeyObject, null));

    sinon.assert.callCount(getJsonFromApiStub, 2);
});

test.serial('martha_v3 parses PDC response correctly', async (t) => {
    const objectId = 'dg.4DFC/f2ffba75-5197-11e9-9a07-0a80fada099c';
    const drsUri = `drs://${config.HOST_CRDC_STAGING}/${objectId}`;
    const {
        access_methods: { 0: { access_id: accessId, access_url: { url: s3Url } } },
    } = pdcResponse;
    const bond = bondUrls('dcf-fence');
    const drs = drsUrls(config.HOST_CRDC_STAGING, objectId, accessId);
    const drsAccessUrlResponse = mockS3AccessUrl(s3Url);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(pdcResponse);
    getJsonFromApiStub.withArgs(bond.accessTokenUrl, terraAuth).resolves(bondAccessTokenResponse);
    getJsonFromApiStub
        .withArgs(drs.accessUrl, `Bearer ${bondAccessTokenResponse.token}`)
        .resolves(drsAccessUrlResponse);
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { 'url': drsUri } }),
        response,
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, pdcDrsMarthaResult(drsAccessUrlResponse));
    sinon.assert.callCount(getJsonFromApiStub, 3);
});

test.serial('martha_v3 parses a PDC CIB URI response correctly', async (t) => {
    const objectId = 'f2ffba75-5197-11e9-9a07-0a80fada099c';
    const drsUri = `drs://dg.4DFC:dg.4DFC/${objectId}`;
    const {
        access_methods: { 0: { access_id: accessId, access_url: { url: s3Url } } },
    } = pdcResponse;
    const bond = bondUrls('dcf-fence');
    const drs = drsUrls(config.HOST_CRDC_STAGING, objectId, accessId);
    const drsAccessUrlResponse = mockS3AccessUrl(s3Url);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(pdcResponse);
    getJsonFromApiStub.withArgs(bond.accessTokenUrl, terraAuth).resolves(bondAccessTokenResponse);
    getJsonFromApiStub
        .withArgs(drs.accessUrl, `Bearer ${bondAccessTokenResponse.token}`)
        .resolves(drsAccessUrlResponse);
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { 'url': drsUri } }),
        response,
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, pdcDrsMarthaResult(drsAccessUrlResponse));
    sinon.assert.callCount(getJsonFromApiStub, 3);
});

// BT-236 temporarily cut access token and access endpoint out of the flow
test.serial('martha_v3 parses BDC response correctly', async (t) => {
    const drsHost = config.HOST_BIODATA_CATALYST_STAGING;
    const {
        id: objectId, self_uri: drsUri,
        // access_methods: { 0: { access_id: accessId, access_url: { url: gsUrl } } }
    } = bdcDrsResponse;
    const bond = bondUrls('fence');
    const drs = drsUrls(drsHost, objectId);
    // const drsAccessUrlResponse = mockGcsAccessUrl(gsUrl);

    getJsonFromApiStub.withArgs(bond.serviceAccountKeyUrl, terraAuth).resolves(googleSAKeyObject);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(bdcDrsResponse);
    // getJsonFromApiStub.withArgs(bond.accessTokenUrl, terraAuth).resolves(bondAccessTokenResponse);
    // getJsonFromApiStub.withArgs(drs.accessUrl, `Bearer ${bondAccessTokenResponse.token}`).resolves(drsAccessUrlResponse);

    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': drsUri } }), response);

    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    t.deepEqual(result, bdcDrsMarthaResult(googleSAKeyObject, null));
    sinon.assert.callCount(getJsonFromApiStub, 2);
});

// BT-236 temporarily cut access token and access endpoint out of the flow
test.serial('martha_v3 parses BDC staging response correctly', async (t) => {
    const bond = bondUrls('fence');
    const { id: objectId, self_uri: drsUri } = bdcDrsResponse;
    const drs = drsUrls(config.HOST_BIODATA_CATALYST_STAGING, objectId);
    getJsonFromApiStub.withArgs(bond.serviceAccountKeyUrl, terraAuth).resolves(googleSAKeyObject);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(bdcDrsResponse);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': drsUri } }), response);

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, bdcDrsMarthaResult(googleSAKeyObject, null));

    sinon.assert.callCount(getJsonFromApiStub, 2);
});

test.serial('martha_v3 parses Anvil response correctly', async (t) => {
    const bond = bondUrls('anvil');
    const { id: objectId, self_uri: drsUri } = anvilDrsResponse;
    const drs = drsUrls(config.HOST_THE_ANVIL_PROD, objectId);
    getJsonFromApiStub.withArgs(bond.serviceAccountKeyUrl, terraAuth).resolves(googleSAKeyObject);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(anvilDrsResponse);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': drsUri } }), response);

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, anvilDrsMarthaResult(googleSAKeyObject, null));

    sinon.assert.callCount(getJsonFromApiStub, 2);
});

test.serial('martha_v3 parses a The AnVIL CIB URI response correctly', async (t) => {
    const bond = bondUrls('anvil');
    const objectId = 'dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0';
    // The object ID contains a '/' so it must be URI-encoded
    const drs = drsUrls(config.HOST_THE_ANVIL_STAGING, encodeURIComponent(objectId));
    getJsonFromApiStub.withArgs(bond.serviceAccountKeyUrl, terraAuth).resolves(googleSAKeyObject);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(anvilDrsResponse);
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.ANV0:dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0' } }),
        response,
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, anvilDrsMarthaResult(googleSAKeyObject, null));

    sinon.assert.callCount(getJsonFromApiStub, 2);
});

test.serial('martha_v3 parses Kids First response correctly', async (t) => {
    const {
        id: objectId, self_uri: drsUri,
        access_methods: { 0: { access_id: accessId, access_url: { url: s3Url } } },
    } = kidsFirstDrsResponse;
    const drsAccessUrlResponse = mockS3AccessUrl(s3Url);
    const bond = bondUrls('kids-first');
    const drs = drsUrls(config.HOST_KIDS_FIRST_STAGING, objectId, accessId);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(kidsFirstDrsResponse);
    getJsonFromApiStub.withArgs(bond.accessTokenUrl, terraAuth).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.withArgs(drs.accessUrl, `Bearer ${bondAccessTokenResponse.token}`)
        .resolves(drsAccessUrlResponse);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': drsUri } }), response);

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, kidsFirstDrsMarthaResult(drsAccessUrlResponse));
    sinon.assert.callCount(getJsonFromApiStub, 3);
});

test.serial('martha_v3 parses a Kids First CIB URI response correctly', async (t) => {
    const {
        id: objectId,
        access_methods: { 0: { access_id: accessId, access_url: { url: s3Url } } }
    } = kidsFirstDrsResponse;
    const bond = bondUrls('kids-first');
    const drs = drsUrls(config.HOST_KIDS_FIRST_STAGING, objectId, accessId);
    const drsAccessUrlResponse = mockS3AccessUrl(s3Url);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(kidsFirstDrsResponse);
    getJsonFromApiStub.withArgs(bond.accessTokenUrl, terraAuth).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.withArgs(drs.accessUrl, `Bearer ${bondAccessTokenResponse.token}`)
        .resolves(drsAccessUrlResponse);
    const response = mockResponse();

    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.F82A1A:3322361c-73a1-403a-a47a-a842964c7a6f' } }),
        response
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, kidsFirstDrsMarthaResult(drsAccessUrlResponse));
    sinon.assert.callCount(getJsonFromApiStub, 3);
});

test.serial('martha_v3 parses HCA response correctly', async (t) => {
    const drs = drsUrls('jade.datarepo-dev.broadinstitute.org', 'v1_4641bafb-5190-425b-aea9-9c7b125515c8_e37266ba-790d-4641-aa76-854d94be2fbe');
    getJsonFromApiStub.withArgs(drs.objectsUrl, terraAuth).resolves(hcaDrsResponse);
    const response = mockResponse();

    await marthaV3(
        mockRequest(
            {
                body: {
                    'url':
                        'drs://jade.datarepo-dev.broadinstitute.org/v1_4641bafb-5190-425b-aea9-9c7b125515c8_e37266ba-790d-4641-aa76-854d94be2fbe'
                }
            }
        ),
        response
    );

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, hcaDrsMarthaResult);

    sinon.assert.callCount(getJsonFromApiStub, 1);
});

const testWithTimeout = (ms, asyncTestFn) => (t) => {
    const waitThenFail = async () => {
        await delay(ms);
        t.fail(`Test did not complete within ${ms}ms`);
    };
    return Promise.race([asyncTestFn(t), waitThenFail()]);
};

test.serial('martha_v3 succeeds even if fetching a signed URL never returns', testWithTimeout(5 * 1000, async (t) => {
    // martha_v3 should return the native access URL instead of letting the Google Cloud Function
    // infrastructure time out after 60 seconds. For the purposes of this test, `testWithTimeout`
    // above fails the test after 5 seconds (playing the role of a very impatient GCF timeout).
    // Meanwhile here, we'll give martha_v3 3 seconds before it gives up on fetching a signed URL.
    overridePencilsDownSeconds(3);
    const {
        id: objectId, self_uri: drsUri,
        access_methods: { 0: { access_id: accessId } }
    } = kidsFirstDrsResponse;
    const bond = bondUrls('kids-first');
    const drs = drsUrls(config.HOST_KIDS_FIRST_STAGING, objectId, accessId);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(kidsFirstDrsResponse);
    getJsonFromApiStub.withArgs(bond.accessTokenUrl, terraAuth).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.withArgs(drs.accessUrl, `Bearer ${bondAccessTokenResponse.token}`).callsFake(async () => {
        await delay(90 * 1000);
        return 'Boom!';
    });
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': drsUri } }), response);

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, kidsFirstDrsMarthaResult(null));
    sinon.assert.callCount(getJsonFromApiStub, 3);
}));

test.serial('martha_v3 fails if something times out before trying to fetch a signed URL', testWithTimeout(5 * 1000, async (t) => {
    overridePencilsDownSeconds(3);
    const { id: objectId, self_uri: drsUri } = kidsFirstDrsResponse;
    const drs = drsUrls(config.HOST_KIDS_FIRST_STAGING, objectId);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).callsFake(async () => {
        await delay(90 * 1000);
        return 'Boom!';
    });
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': drsUri } }), response);

    t.is(response.statusCode, 500);
    t.deepEqual(
        response.body,
        {
            response: {
                status: 500,
                text: 'Timed out resolving DRS URI. Could not fetch DRS metadata.',
            },
            status: 500,
        },
    );
}));

test.serial('martha_v3 passes through the HTTP status if an error is encountered while fetching a signed URL for an S3 object', async (t) => {
    const {
        id: objectId, self_uri: drsUri,
        access_methods: { 0: { access_id: accessId } }
    } = kidsFirstDrsResponse;
    const bond = bondUrls('kids-first');
    const drs = drsUrls(config.HOST_KIDS_FIRST_STAGING, objectId, accessId);
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(kidsFirstDrsResponse);
    getJsonFromApiStub.withArgs(bond.accessTokenUrl, terraAuth).resolves(bondAccessTokenResponse);

    class UnauthorizedError extends Error {
        constructor(message) {
            super(message);
            this.status = 401;
        }
    }

    getJsonFromApiStub.withArgs(drs.accessUrl, `Bearer ${bondAccessTokenResponse.token}`)
        .throws(new UnauthorizedError('Test exception from DRS provider'));

    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': drsUri } }), response);

    t.is(response.statusCode, 401);
    const kidsFirstErrorResult = {
        response: {
            status: 401,
            text: 'Received error contacting DRS provider. Test exception from DRS provider'
        },
        status: 401
    };
    t.deepEqual(response.body, kidsFirstErrorResult);
    sinon.assert.callCount(getJsonFromApiStub, 3);
});

test.serial('martha_v3 returns null for fields missing in drs and bond response', async (t) => {
    const drs = drsUrls(crdc, '123');
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(dosObjectWithMissingFields);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': `drs://${crdc}/123` } }), response); // Also testing dos/drs mismatch here

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, expectedObjWithMissingFields);
});

test.serial('martha_v3 should return 500 if Data Object parsing fails', async (t) => {
    const drs = drsUrls(bdc, '123');
    getJsonFromApiStub.withArgs(drs.objectsUrl, null).resolves(dosObjectWithInvalidFields);
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': `drs://${bdc}/123` } }), response);

    t.is(response.statusCode, 500);
    t.deepEqual(
        response.body,
        {
            response: {
                status: 500,
                text: 'Received error while parsing response from DRS URL. urls.filter is not a function',
            },
            status: 500,
        },
    );
});

/* BT-236 Skip this as it fails in weird ways (not in 'access method parsing') with signed URLs turned off. */
test.skip('martha_v3 should return 500 if access method parsing fails', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(drsObjectWithInvalidFields);

    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0' } }),
        response,
    );
    t.is(response.statusCode, 500);
    const result = response.send.lastCall.args[0];
    t.deepEqual(
        { ...result },
        {
            response: {
                status: 500,
                text: 'Received error while parsing the access id. drsResponse.access_methods is not iterable',
            },
            status: 500,
        },
    );
});

/* BT-236 Skip testing access token fetch failure since that is not something this code even attempts with BDC
 * signed URLs turned off. */
test.skip('martha_v3 should return 500 on exception trying to get access token from Bond', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(bdcDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(null);

    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0' } }),
        response,
    );
    t.is(response.statusCode, 500);
    const result = response.send.lastCall.args[0];
    t.deepEqual(
        { ...result },
        {
            response: {
                status: 500,
                text: "Received error contacting Bond. Cannot read property 'token' of null",
            },
            status: 500,
        },
    );
});

/* BT-236 Skip testing access URL fetch failure since that is not something this code even attempts with BDC
 * signed URLs turned off. */
test.skip('martha_v3 should return 500 on exception trying to get signed URL from DRS provider', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(bdcDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).throws(new Error("Test exception: simulated error from DRS provider"));

    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0' } }),
        response,
    );
    t.is(response.statusCode, 500);
    const result = response.send.lastCall.args[0];
    t.deepEqual(
        { ...result },
        {
            response: {
                status: 500,
                text: 'Received error contacting DRS provider. Test exception: simulated error from DRS provider',
            },
            status: 500,
        },
    );
});

test.serial('martha_v3 generateAccessUrl should generate an access url', (t) => {
    const urlParts = getHttpsUrlParts('drs://some.host.example.com/some_id');
    const drsProvider = new DrsProvider('Test Dummy Provider (TDP)', false, null, null);
    const result = generateAccessUrl(drsProvider, urlParts, 'some_access_id');
    t.is(result, `https://some.host.example.com${PROTOCOL_PREFIX_DRS}/some_id/access/some_access_id`);
});

test.serial('martha_v3 generateAccessUrl should generate an access url with a different port', (t) => {
    const urlParts = getHttpsUrlParts('drs://some.host.example.com:8000/some_id');
    const drsProvider = new DrsProvider('Test Dummy Provider (TDP)', '/some_prefix', false, null, null);
    const result = generateAccessUrl(drsProvider, urlParts, 'some_access_id');
    t.is(result, `https://some.host.example.com:8000${PROTOCOL_PREFIX_DRS}/some_id/access/some_access_id`);
});

/*
This tests a combination of a DOS/DRS URI with a query string that also returns an access_id.
This is hypothetical scenario based on a combination of:
- HCA used to server DOS URIs with query strings
- access_id values are used to retrieve HTTPS signed URLs
 */
test.serial('martha_v3 generateAccessUrl should add the query string to the access url', (t) => {
    const urlParts = getHttpsUrlParts(`drs://${bdc}/some_id?query=value`);
    const drsProvider = new DrsProvider('Test Dummy Provider (TDP)', '/some_prefix', false, null, null);
    const result = generateAccessUrl(drsProvider, urlParts, 'some_access_id');
    t.is(result, `https://${bdc}${PROTOCOL_PREFIX_DRS}/some_id/access/some_access_id?query=value`);
});

/**
 * Determine DRS type using the specified named parameters.
 * @param testUrl {string}
 * @return {string}
 */
function determineDrsProviderWrapper(testUrl) {
    const drsProvider = determineDrsProvider(testUrl);
    const urlParts = getHttpsUrlParts(testUrl);
    return generateMetadataUrl(drsProvider, urlParts);
}

/**
 * determineDrsProvider(uri) -> drsUrl Scenario 1: data objects uri with non-dg host and path
 */
test.serial('martha_v3 determineDrsProvider should parse dos:// Data Object uri', (t) => {
    t.is(determineDrsProviderWrapper(`dos://${bdc}/bar`), `https://${bdc}/ga4gh/drs/v1/objects/bar`);
});

test.serial('martha_v3 determineDrsProvider should parse drs:// Data Object uri', (t) => {
    t.is(determineDrsProviderWrapper(`drs://${bdc}/bar`), `https://${bdc}/ga4gh/drs/v1/objects/bar`);
});

test.serial('martha_v3 determineDrsProvider should parse drs:// Data Object uri with query part', (t) => {
    t.is(
        determineDrsProviderWrapper(`drs://${bdc}/bar?version=1&bananas=yummy`),
        `https://${bdc}/ga4gh/drs/v1/objects/bar?version=1&bananas=yummy`
    );
});

test.serial('martha_v3 determineDrsProvider should parse drs:// Data Object uri when host includes a port number', (t) => {
    // CIB hosts apparently don't handle ports correctly, e.g. using `dg.4503` here doesn't build a "correct" URL.
    t.is(
        determineDrsProviderWrapper(`drs://${bdc}:1234/bar`),
        `https://${bdc}:1234/ga4gh/drs/v1/objects/bar`
    );
});
/**
 * End Scenario 1
 */

/**
 * determineDrsProvider(uri) -> drsUrl Scenario 2: data objects uri with dg host
 */
test.serial('martha_v3 determineDrsProvider should parse "dos://" Data Object uri with a host and path', (t) => {
    t.is(
        determineDrsProviderWrapper('dos://dg.4503/bar'),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects/dg.4503/bar`
    );
});

test.serial('martha_v3 determineDrsProvider should parse "drs://" Data Object uri with a host and path', (t) => {
    t.is(
        determineDrsProviderWrapper('drs://dg.4503/bar'),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects/dg.4503/bar`
    );
});

test.serial('martha_v3 determineDrsProvider should parse "drs://dg." Data Object uri with query part', (t) => {
    t.is(
        determineDrsProviderWrapper('drs://dg.4503/bar?version=1&bananas=yummy'),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects/dg.4503/bar?version=1&bananas=yummy`
    );
});

test.serial('martha_v3 determineDrsProvider should parse "drs://" Data Object uri with an expanded host and path', (t) => {
    t.is(
        determineDrsProviderWrapper(`dos://${config.HOST_BIODATA_CATALYST_STAGING}/dg.2345/bar`),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects/dg.2345/bar`
    );
});
/**
 * End Scenario 2
 */

/**
 * Scenario 3 was all kinds of busted URIs. We have seen ZERO evidence of them IRL / Prod / docs. So no more jumping
 * through hoops to support hypothetical URIs here in the tests.
 *
 * See the Git history for `martha_v2`, latest Martha README, and other tickets for more info/context:
 * - https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit
 * - https://broadworkbench.atlassian.net/browse/BT-4?focusedCommentId=35980
 * - etc.
 */

/**
 * determineDrsProvider(uri) -> drsUrl Scenario 4: data objects uri with jade data repo host
 */
test.serial('martha_v3 should parse Data Object uri with jade data repo DEV as host', (t) => {
    t.is(
        determineDrsProviderWrapper('drs://jade.datarepo-dev.broadinstitute.org/973b5e79-6433-40ce-bf38-686ab7f17820'),
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test.serial('martha_v3 should parse Data Object uri with jade data repo DEV as host and path with snapshot id', (t) => {
    t.is(
        determineDrsProviderWrapper('drs://jade.datarepo-dev.broadinstitute.org/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'),
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test.serial('martha_v3 should parse Data Object uri with jade data repo PROD as host', (t) => {
    t.is(
        determineDrsProviderWrapper('drs://data.terra.bio/anything'),
        'https://data.terra.bio/ga4gh/drs/v1/objects/anything'
    );
});

test.serial('martha_v3 should parse Data Object uri with host that looks like jade data repo host', (t) => {
    t.is(
        determineDrsProviderWrapper('drs://jade-data-repo.datarepo-dev.broadinstitute.org/v1_anything'),
        'https://jade-data-repo.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_anything'
    );
});
/**
 * End Scenario 4
 */

/**
 * determineDrsProvider(uri) -> drsUrl Scenario 5: data objects uri with the AnVIL data repo host
 *
 * TODO: Test prod expansion of compact identifiers
 */
test.serial('martha_v3 should parse Data Object uri with the AnVIL prefix dg.ANV0', (t) => {
    t.is(
        determineDrsProviderWrapper('drs://dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0'),
        `https://${config.HOST_THE_ANVIL_STAGING}/ga4gh/drs/v1/objects/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`,
    );
});

test.serial('martha_v3 should parse Data Object uri with the AnVIL prod host', (t) => {
    t.is(
        determineDrsProviderWrapper(`drs://${config.HOST_THE_ANVIL_PROD}/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`),
        `https://${config.HOST_THE_ANVIL_PROD}/ga4gh/drs/v1/objects/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`
    );
});

test.serial('martha_v3 should parse Data Object uri with the AnVIL staging host', (t) => {
    t.is(
        determineDrsProviderWrapper(`drs://${config.HOST_THE_ANVIL_STAGING}/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`),
        `https://${config.HOST_THE_ANVIL_STAGING}/ga4gh/drs/v1/objects/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`,
    );
});

/**
 * End Scenario 5
 */

/**
 * determineDrsProvider(uri) -> drsUrl Scenario 6: data objects uri with the Kids First
 *
 * TODO: Test prod expansion of compact identifiers
 */
test.serial('martha_v3 should parse Data Object uri with the Kids First prefix dg.F82A1A', (t) => {
    t.is(
        determineDrsProviderWrapper('drs://dg.F82A1A/ed6be7ab-068e-46c8-824a-f39cfbb885cc'),
        `https://${config.HOST_KIDS_FIRST_STAGING}/ga4gh/drs/v1/objects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

test.serial('martha_v3 should parse Data Object uri with the Kids First prod repo as host', (t) => {
    t.is(
        determineDrsProviderWrapper(`drs://${config.HOST_KIDS_FIRST_PROD}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`),
        `https://${config.HOST_KIDS_FIRST_PROD}/ga4gh/drs/v1/objects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

test.serial('martha_v3 should parse Data Object uri with the Kids First staging repo as host', (t) => {
    t.is(
        determineDrsProviderWrapper(`drs://${config.HOST_KIDS_FIRST_STAGING}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`),
        `https://${config.HOST_KIDS_FIRST_STAGING}/ga4gh/drs/v1/objects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

/**
 * End Scenario 6
 */

/**
 * determineDrsProvider(uri) -> drsUrl Scenario 7: data objects uri with CRDC
 *
 * TODO: Test prod expansion of compact identifiers
 */
test.serial('martha_v3 should parse Data Object uri with CRDC prefix dg.4DFC', (t) => {
    t.is(
        determineDrsProviderWrapper('drs://dg.4DFC/ed6be7ab-068e-46c8-824a-f39cfbb885cc'),
        `https://${config.HOST_CRDC_STAGING}/ga4gh/drs/v1/objects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

test.serial('martha_v3 should parse Data Object uri with CRDC prod repo as host', (t) => {
    t.is(
        determineDrsProviderWrapper(`drs://${config.HOST_CRDC_PROD}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`),
        `https://${config.HOST_CRDC_PROD}/ga4gh/drs/v1/objects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

test.serial('martha_v3 should parse Data Object uri with CRDC staging repo as host', (t) => {
    t.is(
        determineDrsProviderWrapper(`drs://${config.HOST_CRDC_STAGING}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`),
        `https://${config.HOST_CRDC_STAGING}/ga4gh/drs/v1/objects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

/**
 * End Scenario 7
 */

/**
 * determineDrsProvider(uri) -> drsUrl Scenario 8: data objects uri with BDC
 *
 * TODO: Test prod expansion of compact identifiers
 */
test.serial('martha_v3 should parse Data Object uri with BDC prefix dg.712C', (t) => {
    t.is(
        determineDrsProviderWrapper('drs://dg.712C/fc046e84-6cf9-43a3-99cc-ffa2964b88cb'),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects/dg.712C/fc046e84-6cf9-43a3-99cc-ffa2964b88cb`,
    );
});

test.serial('martha_v3 should parse Data Object uri with BDC prod repo as host', (t) => {
    t.is(
        determineDrsProviderWrapper(`drs://${config.HOST_BIODATA_CATALYST_PROD}/fc046e84-6cf9-43a3-99cc-ffa2964b88cb`),
        `https://${config.HOST_BIODATA_CATALYST_PROD}/ga4gh/drs/v1/objects/fc046e84-6cf9-43a3-99cc-ffa2964b88cb`,
    );
});

test.serial('martha_v3 should parse Data Object uri with BDC staging repo as host', (t) => {
    t.is(
        determineDrsProviderWrapper(`drs://${config.HOST_BIODATA_CATALYST_STAGING}/fc046e84-6cf9-43a3-99cc-ffa2964b88cb`),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects/fc046e84-6cf9-43a3-99cc-ffa2964b88cb`,
    );
});

/**
 * End Scenario 8
 */

test.serial('martha_v3 should return 4xx with an unrecognized CIB hostname', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': `drs://dg.CAFE/123` } }), response);

    t.is(response.statusCode, 400);
    t.deepEqual(
        response.body,
        {
            response: {
                status: 400,
                text: `Request is invalid. Unrecognized Compact Identifier Based host 'dg.CAFE.'`,
            },
            status: 400,
        },
    );
});

test.serial('martha_v3 should return 400 with an unrecognized hostname (failed attempt at CIB hostname)', async (t) => {
    const response = mockResponse();

    await marthaV3(mockRequest({ body: { 'url': `drs://dg4.DFC/123` } }), response);

    t.is(response.statusCode, 400);
    t.deepEqual(
        response.body,
        {
            response: {
                status: 400,
                text: `Request is invalid. Could not determine DRS provider for id 'drs://dg4.DFC/123'`,
            },
            status: 400,
        },
    );
});
