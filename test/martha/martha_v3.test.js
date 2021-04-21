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
    dataGuidsOrgResponse,
    dataGuidsOrgMarthaResult,
    jadeDrsResponse,
    jadeDrsMarthaResult,
    hcaDrsMarthaResult,
    hcaDrsResponse,
    bdcDrsMarthaResult,
    bdcDrsResponse,
    bdcDrsResponseCustom,
    kidsFirstDrsResponse,
    kidsFirstDrsMarthaResult,
    anvilDrsMarthaResult,
    anvilDrsResponse,
    gen3CrdcDrsMarthaResult,
    gen3CrdcResponse,
    dosObjectWithMissingFields,
    dosObjectWithInvalidFields,
    drsObjectWithInvalidFields,
    expectedObjWithMissingFields,
} = require('./_martha_v3_resources.js');

const test = require('ava');
const sinon = require('sinon');
const {
    MARTHA_V3_ALL_FIELDS,
    REQUEST_TIMEOUT_RESULT,
    DrsType,
    getDrsAccessId,
    getHttpsUrlParts,
    generateMetadataUrl,
    generateAccessUrl,
    determineDrsType,
    marthaV3Handler: marthaV3,
} = require('../../martha/martha_v3');
const apiAdapter = require('../../common/api_adapter');
const config = require('../../common/config');
const mask = require('json-mask');

const bearerAuth = 'bearer abc123';

const mockRequest = (req, requestFields = MARTHA_V3_ALL_FIELDS) => {
    req.method = 'POST';
    req.headers = { authorization: bearerAuth };
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
        send: sinon.stub(),
        setHeader: sinon.stub()
    };
};

const googleSAKeyObject = { key: 'A Google Service Account private key json object' };

const bondAccessTokenResponse = {
    token: 'my-fake-token',
    expires_at: 'NEVER'
};

function mockGcsAccessUrl(gsUrlString) {
    const gsUrl = new URL(gsUrlString);
    return { url: `https://storage.googleapis.com/${gsUrl.hostname}${gsUrl.pathname}?sig=ABC` };
}

const bondSAKeyUrlRegEx = /^https:\/\/([^/]+)\/api\/link\/v1\/([a-z-]+)\/serviceaccount\/key$/;

const bondAccessTokenUrlRegEx = /^https:\/\/([^/]+)\/api\/link\/v1\/([a-z-]+)\/accesstoken$/;

let getJsonFromApiStub;
const getJsonFromApiMethodName = 'getJsonFrom';
const sandbox = sinon.createSandbox();

test.serial.beforeEach(() => {
    sandbox.restore(); // If one test fails, the .afterEach() block will not execute, so always clean the slate here
    getJsonFromApiStub = sandbox.stub(apiAdapter, getJsonFromApiMethodName);
});

test.serial.afterEach(() => {
    sandbox.restore();
});

test.serial('martha_v3 uses the default error handler for unexpected errors', async (t) => {
    const expectedError = new Error('Expected test error');
    const badReq = { get headers() { throw expectedError; } };
    const response = mockResponse();
    const actualError = await t.throwsAsync(marthaV3(badReq, response));
    t.is(actualError, expectedError);
    sinon.assert.callCount(response.send, 0);
});

// Test the "default" case because we don't know who you are.
test.serial('martha_v3 resolves a valid DOS-style url', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 2); // Bond was called to get SA key
    t.deepEqual({ ...result }, sampleDosMarthaResult(googleSAKeyObject));
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        'https://abc/ga4gh/dos/v1/dataobjects/123',
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed
    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'dcf-fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

// According to the DRS specification authors [0] it's OK for a client to call Martha with a `drs://` URI and get
// back a DOS object. Martha should just "do the right thing" and return whichever format the server supports,
// instead of erroring out with a 404 due the URI not being found [1].
//
// [0] https://ucsc-cgl.atlassian.net/browse/AZUL-702
// [1] https://broadinstitute.slack.com/archives/G011ZUKHCUX/p1597694952108600
test.serial('martha_v3 resolves a valid DRS-style url', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 2); // Bond was called to get SA key
    t.deepEqual({ ...result }, sampleDosMarthaResult(googleSAKeyObject));
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        'https://abc/ga4gh/dos/v1/dataobjects/123',
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed
    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'dcf-fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial("martha_v3 resolves successfully and ignores extra data submitted besides a 'url'", async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            pattern: 'gs://',
            foo: 'bar',
        },
    }), response);
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 2); // Bond was called to get SA key
    t.deepEqual({ ...result }, sampleDosMarthaResult(googleSAKeyObject));
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        'https://abc/ga4gh/dos/v1/dataobjects/123',
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed
    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'dcf-fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 does not call Bond when only DRS fields are requested', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            fields: ['gsUri', 'size', 'hashes', 'timeUpdated', 'fileName'],
        },
    }), response);
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 1); // Bond was not called to get SA key
    t.deepEqual(
        { ...result },
        mask(sampleDosMarthaResult(googleSAKeyObject), 'gsUri,size,hashes,timeUpdated,fileName'),
    );
    t.falsy(result.googleServiceAccount);
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        'https://abc/ga4gh/dos/v1/dataobjects/123',
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed
});

test.serial('martha_v3 calls the correct endpoints the googleServiceAccount is requested', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            fields: ['googleServiceAccount'],
        },
    }), response);
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 1); // DRS was not called
    t.deepEqual(
        { ...result },
        mask(sampleDosMarthaResult(googleSAKeyObject), 'googleServiceAccount'),
    );
    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(0).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'dcf-fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 calls the correct endpoints when only the accessUrl is requested', async (t) => {
    const drsAccessUrlResponse = mockGcsAccessUrl(bdcDrsResponse.access_methods[0].access_url.url);
    getJsonFromApiStub.onCall(0).resolves(bdcDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(drsAccessUrlResponse);
    const response = mockResponse();
    await marthaV3(
        mockRequest(
            {
                body: {
                    url: 'drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0',
                    fields: ['accessUrl'],
                }
            },
        ),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 3); // Bond was not called to retrieve the googleServiceAccount
    t.deepEqual(
        { ...result },
        mask(bdcDrsMarthaResult(googleSAKeyObject, drsAccessUrlResponse), 'accessUrl'),
    );

    const requestedBondAccessTokenUrl = getJsonFromApiStub.getCall(1).args[0];
    const accessTokenUrlMatches = requestedBondAccessTokenUrl.match(bondAccessTokenUrlRegEx);
    t.truthy(accessTokenUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedAccessTokenProvider = 'fence';
    const actualAccessTokenProvider = accessTokenUrlMatches[2];
    t.is(actualAccessTokenProvider, expectedAccessTokenProvider);

    t.is(
        getJsonFromApiStub.getCall(2).args[0],
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects` +
        '/dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0/access/gs',
    );
    t.is(getJsonFromApiStub.getCall(2).args[1], `Bearer ${bondAccessTokenResponse.token}`);
});

test.serial('martha_v3 calls the correct endpoints when the accessUrl times out', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(bdcDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(REQUEST_TIMEOUT_RESULT);
    getJsonFromApiStub.onCall(3).resolves(googleSAKeyObject);

    const response = mockResponse();
    await marthaV3(
        mockRequest(
            {
                body: {
                    url: 'drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0',
                    fields: ['accessUrl', 'googleServiceAccount'],
                },
            },
        ),
        response,
    );
    t.is(response.statusCode, 200);

    sinon.assert.callCount(response.send, 1);
    const result = response.send.getCall(0).args[0];
    t.deepEqual(
        { ...result },
        mask(bdcDrsMarthaResult(googleSAKeyObject, null), 'accessUrl,googleServiceAccount'),
    );

    sinon.assert.callCount(getJsonFromApiStub, 4);
    t.deepEqual(
        getJsonFromApiStub.getCall(0).args,
        [
            `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects` +
            '/dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0',
            null,
        ],
    );
    t.deepEqual(
        getJsonFromApiStub.getCall(1).args,
        ['https://broad-bond-dev.appspot.com/api/link/v1/fence/accesstoken', bearerAuth],
    );
    t.deepEqual(
        getJsonFromApiStub.getCall(2).args,
        [
            `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects` +
            '/dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0/access/gs',
            `Bearer ${bondAccessTokenResponse.token}`,
        ],
    );
    t.deepEqual(
        getJsonFromApiStub.getCall(3).args,
        ['https://broad-bond-dev.appspot.com/api/link/v1/fence/serviceaccount/key', bearerAuth],
    );
});

test.serial('martha_v3 calls the correct endpoints when only the fileName is requested and the metadata contains a name', async (t) => {
    const drsResponse = bdcDrsResponseCustom({
        name: 'HG01131.final.cram.crai',
        access_url: { url: bdcDrsResponse.access_methods[0].access_url.url },
        access_id: bdcDrsResponse.access_methods[0].access_id,
    });
    const drsAccessUrlResponse = mockGcsAccessUrl(bdcDrsResponse.access_methods[0].access_url.url);
    getJsonFromApiStub.onCall(0).resolves(drsResponse);
    const response = mockResponse();
    await marthaV3(
        mockRequest(
            {
                body: {
                    url: 'drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0',
                    fields: ['fileName'],
                }
            },
        ),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 1); // File name available from the metadata
    t.deepEqual(
        { ...result },
        mask(bdcDrsMarthaResult(googleSAKeyObject, drsAccessUrlResponse), 'fileName'),
    );
});

test.serial('martha_v3 calls the correct endpoints when only the fileName is requested and the metadata contains only an access id', async (t) => {
    const drsResponse = bdcDrsResponseCustom({
        name: null,
        access_url: { url: null },
        access_id: bdcDrsResponse.access_methods[0].access_id,
    });
    getJsonFromApiStub.onCall(0).resolves(drsResponse);
    const response = mockResponse();
    await marthaV3(
        mockRequest(
            {
                body: {
                    url: 'drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0',
                    fields: ['fileName'],
                }
            },
        ),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 1); // Bond was not called to retrieve the googleServiceAccount
    t.deepEqual({ ...result }, { fileName: null });
});

test.serial('martha_v3 calls returns the DRS name field for a file name even when it differs from the access url', async (t) => {
    const drsResponse = bdcDrsResponseCustom({
        name: 'from_name_field.txt',
        access_url: { url: null },
        access_id: bdcDrsResponse.access_methods[0].access_id,
    });
    const drsAccessUrlResponse = mockGcsAccessUrl('gs://mybucket/from_access_url.txt');
    getJsonFromApiStub.onCall(0).resolves(drsResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(drsAccessUrlResponse);
    const response = mockResponse();
    await marthaV3(
        mockRequest(
            {
                body: {
                    url: 'drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0',
                    fields: ['fileName', 'accessUrl'],
                }
            },
        ),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 3); // Bond was not called to retrieve the googleServiceAccount
    t.deepEqual(
        { ...result },
        {
            accessUrl: { url: 'https://storage.googleapis.com/mybucket/from_access_url.txt?sig=ABC' },
            fileName: 'from_name_field.txt',
        },
    );

    const requestedBondAccessTokenUrl = getJsonFromApiStub.getCall(1).args[0];
    const accessTokenUrlMatches = requestedBondAccessTokenUrl.match(bondAccessTokenUrlRegEx);
    t.truthy(accessTokenUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedAccessTokenProvider = 'fence';
    const actualAccessTokenProvider = accessTokenUrlMatches[2];
    t.is(actualAccessTokenProvider, expectedAccessTokenProvider);

    t.is(
        getJsonFromApiStub.getCall(2).args[0],
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects` +
        '/dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0/access/gs',
    );
    t.is(getJsonFromApiStub.getCall(2).args[1], `Bearer ${bondAccessTokenResponse.token}`);
});

test.serial('martha_v3 calls no endpoints when no fields are requested', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            fields: [],
        }
    }), response);
    t.is(response.statusCode, 200);
    sinon.assert.callCount(getJsonFromApiStub, 0); // Neither Bond nor DRS was called
    const result = response.send.lastCall.args[0];
    t.deepEqual({ ...result }, {});
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
    sinon.assert.callCount(getJsonFromApiStub, 0); // Neither Bond nor DRS was called
    const result = response.send.lastCall.args[0];
    t.deepEqual(
        { ...result },
        {
            response: {
                status: 400,
                text: "Request is invalid. 'fields' was not an array.",
            },
            status: 400,
        },
    );
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
    sinon.assert.callCount(getJsonFromApiStub, 0); // Neither Bond nor DRS was called
    const result = response.send.lastCall.args[0];
    t.deepEqual(
        { ...result },
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
});

test.serial('martha_v3 should return 400 if a Data Object without authorization header is provided', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    const response = mockResponse();
    const mockReq = mockRequest({ body: { 'url': 'dos://abc/123' } });
    delete mockReq.headers.authorization;
    await marthaV3(mockReq, response);
    t.is(response.statusCode, 400);
    const result = response.send.lastCall.args[0];
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. Authorization header is missing.');
});

test.serial('martha_v3 should return 400 if not given a url', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'uri': 'dos://abc/123' } }), response);
    t.is(response.statusCode, 400);
    const result = response.send.lastCall.args[0];
    t.is(result.status, 400);
    t.is(result.response.text, "Request is invalid. 'url' is missing.");
});

test.serial('martha_v3 should return 400 if given a dg URL without a path', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://dg.abc' } }), response);
    t.is(response.statusCode, 400);
    const result = response.send.lastCall.args[0];
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. "dos://dg.abc" is missing a host and/or a path.');
});

test.serial('martha_v3 should return 400 if given a dg URL with only a path', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos:///dg.abc' } }), response);
    t.is(response.statusCode, 400);
    const result = response.send.lastCall.args[0];
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. "dos:///dg.abc" is missing a host and/or a path.');
});

test.serial('martha_v3 should return 400 if no data is posted with the request', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({}), response);
    t.is(response.statusCode, 400);
    const result = response.send.lastCall.args[0];
    t.is(result.status, 400);
    t.is(result.response.text, "Request is invalid. 'url' is missing.");
});

test.serial('martha_v3 should return 400 if given a \'url\' with an invalid value', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { url: 'Not a valid URI' } }), response);
    t.is(response.statusCode, 400);
    const result = response.send.lastCall.args[0];
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. Invalid URL: Not a valid URI');
});

test.serial('martha_v3 should return 500 if Data Object resolution fails', async (t) => {
    getJsonFromApiStub.onCall(0).rejects(new Error('Data Object Resolution forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    t.is(response.statusCode, 500);
    const result = response.send.lastCall.args[0];
    t.is(result.status, 500);
    t.is(result.response.text, 'Received error while resolving DRS URL. Data Object Resolution forced to fail by testing stub');
});

test.serial('martha_v3 should return the underlying status if Data Object resolution fails', async (t) => {
    const error = new Error('Data Object Resolution forced to fail by testing stub');
    error.status = 418;
    getJsonFromApiStub.onCall(0).rejects(error);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    t.is(response.statusCode, 418);
    const result = response.send.lastCall.args[0];
    t.is(result.status, 418);
    t.is(
        result.response.text,
        'Received error while resolving DRS URL. Data Object Resolution forced to fail by testing stub',
    );
});

test.serial('martha_v3 should return 500 if key retrieval from Bond fails', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    getJsonFromApiStub.onCall(1).rejects(new Error('Bond key lookup forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    t.is(response.statusCode, 500);
    const result = response.send.lastCall.args[0];
    t.is(result.status, 500);
    t.is(result.response.text, 'Received error contacting Bond. Bond key lookup forced to fail by testing stub');
});

test.serial('martha_v3 calls bond Bond with the "dcf-fence" provider when the Data Object URL host is not "dg.4503"', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'dcf-fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 calls bond Bond with the "fence" provider when the Data Object URL host is "dg.4503"', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://dg.4503/this_part_can_be_anything' } }), response);
    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial(
    'martha_v3 does call Bond and return SA key when the host url is for dataguids.org',
    async (t) => {
        getJsonFromApiStub.onCall(0).resolves(dataGuidsOrgResponse);
        getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
        const response = mockResponse();
        await marthaV3(
            mockRequest({ body: { 'url': 'dos://dataguids.org/a41b0c4f-ebfb-4277-a941-507340dea85d' } }),
            response
        );
        t.is(response.statusCode, 200);
        const result = response.send.lastCall.args[0];
        sinon.assert.callCount(getJsonFromApiStub, 2); // Bond was called to get SA key
        t.deepEqual({ ...result }, dataGuidsOrgMarthaResult(googleSAKeyObject));
        t.is(
            getJsonFromApiStub.getCall(0).args[0],
            'https://dataguids.org/ga4gh/dos/v1/dataobjects/a41b0c4f-ebfb-4277-a941-507340dea85d',
        );
        t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed
        const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
        const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
        t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
        const expectedSAKeyProvider = 'dcf-fence';
        const actualSAKeyProvider = saKeyUrlMatches[2];
        t.is(actualSAKeyProvider, expectedSAKeyProvider);
    }
);

test.serial('martha_v3 does not call Bond or return SA key when the host url is for jade data repo', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(jadeDrsResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 1); // Bond was not called to get SA key
    t.deepEqual({ ...result }, jadeDrsMarthaResult);
    t.falsy(result.googleServiceAccount);
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/abc',
    );
    t.is(getJsonFromApiStub.getCall(0).args[1], 'bearer abc123');
});

test.serial('martha_v3 parses Gen3 CRDC response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(gen3CrdcResponse);
    getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': `dos://${config.HOST_CRDC_STAGING}/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc` } }),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 2);
    t.deepEqual({ ...result }, gen3CrdcDrsMarthaResult(googleSAKeyObject, null));
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        `https://${config.HOST_CRDC_STAGING}/ga4gh/drs/v1/objects/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc`,
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed

    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'dcf-fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 parses a Gen3 CRDC CIB URI response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(gen3CrdcResponse);
    getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'dos://dg.4DFC:206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc' } }),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 2);
    t.deepEqual({ ...result }, gen3CrdcDrsMarthaResult(googleSAKeyObject, null));
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        `https://${config.HOST_CRDC_STAGING}/ga4gh/drs/v1/objects/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc`,
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed

    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'dcf-fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 parses BDC response correctly', async (t) => {
    const drsAccessUrlResponse = mockGcsAccessUrl(bdcDrsResponse.access_methods[0].access_url.url);
    // Rotated once from Michael Baumann's sequence diagram so that call 0 is the second call down from the top,
    // call 3 is the top call.
    // https://lucid.app/lucidchart/428a0bdd-a884-4fc7-9a49-7bf300ef6777/edit?shared=true&page=0_0#
    getJsonFromApiStub.onCall(0).resolves(bdcDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(drsAccessUrlResponse);
    getJsonFromApiStub.onCall(3).resolves(googleSAKeyObject);

    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0' } }),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    // Bond was called twice to get SA key and access token.
    // DRS server was called twice to get DRS response and signed URL.
    // 2 + 2 = 4.
    sinon.assert.callCount(getJsonFromApiStub, 4);

    t.deepEqual({ ...result }, bdcDrsMarthaResult(googleSAKeyObject, drsAccessUrlResponse));

    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects` +
        '/dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0',
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed

    const requestedBondAccessTokenUrl = getJsonFromApiStub.getCall(1).args[0];
    const accessTokenUrlMatches = requestedBondAccessTokenUrl.match(bondAccessTokenUrlRegEx);
    t.truthy(accessTokenUrlMatches, 'Bond access token URL called does not match Bond access token URL regular expression');
    const expectedAccessTokenProvider = 'fence';
    const actualAccessTokenProvider = accessTokenUrlMatches[2];
    t.is(actualAccessTokenProvider, expectedAccessTokenProvider);

    t.is(
        getJsonFromApiStub.getCall(2).args[0],
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects` +
        '/dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0/access/gs',
    );
    t.is(getJsonFromApiStub.getCall(2).args[1], `Bearer ${bondAccessTokenResponse.token}`);

    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(3).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 parses BDC staging response correctly', async (t) => {
    const drsAccessUrlResponse = mockGcsAccessUrl(bdcDrsResponse.access_methods[0].access_url.url);
    getJsonFromApiStub.onCall(0).resolves(bdcDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(drsAccessUrlResponse);
    getJsonFromApiStub.onCall(3).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.712C/fc046e84-6cf9-43a3-99cc-ffa2964b88cb' } }),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 4);
    t.deepEqual({ ...result }, bdcDrsMarthaResult(googleSAKeyObject, drsAccessUrlResponse));
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects` +
        '/dg.712C/fc046e84-6cf9-43a3-99cc-ffa2964b88cb',
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed

    const requestedBondAccessTokenUrl = getJsonFromApiStub.getCall(1).args[0];
    const accessTokenUrlMatches = requestedBondAccessTokenUrl.match(bondAccessTokenUrlRegEx);
    t.truthy(accessTokenUrlMatches, 'Bond access token URL called does not match Bond access token URL regular expression');
    const expectedAccessTokenProvider = 'fence';
    const actualAccessTokenProvider = accessTokenUrlMatches[2];
    t.is(actualAccessTokenProvider, expectedAccessTokenProvider);

    t.is(
        getJsonFromApiStub.getCall(2).args[0],
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects` +
        '/dg.712C/fc046e84-6cf9-43a3-99cc-ffa2964b88cb/access/gs',
    );
    t.is(getJsonFromApiStub.getCall(2).args[1], `Bearer ${bondAccessTokenResponse.token}`);

    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(3).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 parses Anvil response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(anvilDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0' } }),
        response,
    );
    t.is(response.statusCode, 200);

    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 2); // Bond was called to get SA key
    t.deepEqual({ ...result }, anvilDrsMarthaResult(googleSAKeyObject, null));
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        `https://${config.HOST_THE_ANVIL_STAGING}/ga4gh/drs/v1/objects/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`,
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed

    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'anvil';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 parses a The AnVIL CIB URI response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(anvilDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.ANV0:dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0' } }),
        response,
    );
    t.is(response.statusCode, 200);

    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 2); // Bond was called to get SA key
    t.deepEqual({ ...result }, anvilDrsMarthaResult(googleSAKeyObject, null));
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        `https://${config.HOST_THE_ANVIL_STAGING}/ga4gh/drs/v1/objects/dg.ANV0%2F00008531-03d7-418c-b3d3-b7b22b5381a0`,
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed

    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'anvil';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 parses Kids First response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(kidsFirstDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': `drs://${config.HOST_KIDS_FIRST_STAGING}/ed6be7ab-068e-46c8-824a-f39cfbb885cc` } }),
        response
    );
    t.is(response.statusCode, 200);

    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 2); // Bond was called to get SA key
    t.deepEqual({ ...result }, kidsFirstDrsMarthaResult(googleSAKeyObject));
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        `https://${config.HOST_KIDS_FIRST_STAGING}/ga4gh/dos/v1/dataobjects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed
    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'dcf-fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 parses a Kids First CIB URI response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(kidsFirstDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.F82A1A:ed6be7ab-068e-46c8-824a-f39cfbb885cc' } }),
        response
    );
    t.is(response.statusCode, 200);

    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 2); // Bond was called to get SA key
    t.deepEqual({ ...result }, kidsFirstDrsMarthaResult(googleSAKeyObject));
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        `https://${config.HOST_KIDS_FIRST_STAGING}/ga4gh/dos/v1/dataobjects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed
    const requestedBondSAKeyUrl = getJsonFromApiStub.getCall(1).args[0];
    const saKeyUrlMatches = requestedBondSAKeyUrl.match(bondSAKeyUrlRegEx);
    t.truthy(saKeyUrlMatches, 'Bond SA key URL called does not match Bond SA key URL regular expression');
    const expectedSAKeyProvider = 'dcf-fence';
    const actualSAKeyProvider = saKeyUrlMatches[2];
    t.is(actualSAKeyProvider, expectedSAKeyProvider);
});

test.serial('martha_v3 parses HCA response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(hcaDrsResponse);
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
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 1); // Bond was not called to get SA key
    t.deepEqual({ ...result }, hcaDrsMarthaResult);
    t.falsy(result.googleServiceAccount);
    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_4641bafb-5190-425b-aea9-9c7b125515c8_e37266ba-790d-4641-aa76-854d94be2fbe',
    );
    t.is(getJsonFromApiStub.getCall(0).args[1], 'bearer abc123');
});

test.serial('martha_v3 returns null for fields missing in drs and bond response', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(dosObjectWithMissingFields);

    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    t.deepEqual({ ...result }, expectedObjWithMissingFields);
});

test.serial('martha_v3 should return 500 if Data Object parsing fails', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(dosObjectWithInvalidFields);

    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
    t.is(response.statusCode, 500);
    const result = response.send.lastCall.args[0];
    t.deepEqual(
        { ...result },
        {
            response: {
                status: 500,
                text: 'Received error while parsing response from DRS URL. urls.filter is not a function',
            },
            status: 500,
        },
    );
});

test.serial('martha_v3 should return 500 if access method parsing fails', async (t) => {
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

test.serial('martha_v3 should return 500 on exception trying to get access token from Bond', async (t) => {
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

test.serial('martha_v3 should return 500 on exception trying to get signed URL from DRS provider', async (t) => {
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

test.serial('martha_v3 getDrsAccessId should return an access_id for a matching accessMethodType', (t) => {
    const drsResponse = { access_methods: [{ type: 'some_access_method_type', access_id: 'some_access_id' }] };
    const result = getDrsAccessId(drsResponse, 'some_access_method_type');
    t.is(result, 'some_access_id');
});

test.serial('martha_v3 getDrsAccessId should not return an access_id for a mismatching accessMethodType', (t) => {
    const drsResponse = { access_methods: [{ type: 'some_access_method_type', access_id: 'some_access_id' }] };
    const result = getDrsAccessId(drsResponse, 'mismatching_access_method_type');
    t.is(typeof result, 'undefined');
});

test.serial('martha_v3 getDrsAccessId should not return an access_id for a null accessMethodType', (t) => {
    const drsResponse = { access_methods: [{ type: 'some_access_method_type', access_id: 'some_access_id' }] };
    const result = getDrsAccessId(drsResponse, null);
    t.is(typeof result, 'undefined');
});

test.serial('martha_v3 generateAccessUrl should generate an access url', (t) => {
    const urlParts = getHttpsUrlParts('drs://some.host.example.com/some_id');
    const drsType = new DrsType(urlParts, '/some_prefix', false, null, null);
    const result = generateAccessUrl(drsType, 'some_access_id');
    t.is(result, 'https://some.host.example.com/some_prefix/some_id/access/some_access_id');
});

test.serial('martha_v3 generateAccessUrl should generate an access url with a different port', (t) => {
    const urlParts = getHttpsUrlParts('drs://some.host.example.com:8000/some_id');
    const drsType = new DrsType(urlParts, '/some_prefix', false, null, null);
    const result = generateAccessUrl(drsType, 'some_access_id');
    t.is(result, 'https://some.host.example.com:8000/some_prefix/some_id/access/some_access_id');
});

/*
This tests a combination of a DOS/DRS URI with a query string that also returns an access_id.
This is hypothetical scenario based on a combination of:
- HCA used to server DOS URIs with query strings
- access_id values are used to retrieve HTTPS signed URLs
 */
test.serial('martha_v3 generateAccessUrl should add the query string to the access url', (t) => {
    const urlParts = getHttpsUrlParts('drs://some.host.example.com/some_id?query=value');
    const drsType = new DrsType(urlParts, '/some_prefix', false, null, null);
    const result = generateAccessUrl(drsType, 'some_access_id');
    t.is(result, 'https://some.host.example.com/some_prefix/some_id/access/some_access_id?query=value');
});

/**
 * Determine DRS type using the specified named parameters.
 * @param testUrl {string}
 * @return {string}
 */
function determineDrsTypeTestWrapper(testUrl) {
    const drsType = determineDrsType(testUrl);
    return generateMetadataUrl(drsType);
}

/**
 * determineDrsType(uri) -> drsUrl Scenario 1: data objects uri with non-dg host and path
 */
test.serial('martha_v3 determineDrsType should parse dos:// Data Object uri', (t) => {
    t.is(determineDrsTypeTestWrapper('dos://fo.o/bar'), 'https://fo.o/ga4gh/dos/v1/dataobjects/bar');
});

test.serial('martha_v3 determineDrsType should parse drs:// Data Object uri', (t) => {
    t.is(determineDrsTypeTestWrapper('drs://fo.o/bar'), 'https://fo.o/ga4gh/dos/v1/dataobjects/bar');
});

test.serial('martha_v3 determineDrsType should parse drs:// Data Object uri with query part', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://fo.o/bar?version=1&bananas=yummy'),
        'https://fo.o/ga4gh/dos/v1/dataobjects/bar?version=1&bananas=yummy'
    );
});

test.serial('martha_v3 determineDrsType should parse drs:// Data Object uri when host includes a port number', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://foo.com:1234/bar'),
        'https://foo.com:1234/ga4gh/dos/v1/dataobjects/bar'
    );
});
/**
 * End Scenario 1
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 2: data objects uri with dg host
 */
test.serial('martha_v3 determineDrsType should parse "dos://" Data Object uri with a host and path', (t) => {
    t.is(
        determineDrsTypeTestWrapper('dos://dg.2345/bar'),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/dg.2345/bar`
    );
});

test.serial('martha_v3 determineDrsType should parse "drs://" Data Object uri with a host and path', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://dg.2345/bar'),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/dg.2345/bar`
    );
});

test.serial('martha_v3 determineDrsType should parse "drs://dg." Data Object uri with query part', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://dg.2345/bar?version=1&bananas=yummy'),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/dg.2345/bar?version=1&bananas=yummy`
    );
});

test.serial('martha_v3 determineDrsType should parse "drs://" Data Object uri with an expanded host and path', (t) => {
    t.is(
        determineDrsTypeTestWrapper(`dos://${config.HOST_BIODATA_CATALYST_STAGING}/dg.2345/bar`),
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
 * determineDrsType(uri) -> drsUrl Scenario 4: data objects uri with jade data repo host
 */
test.serial('martha_v3 should parse Data Object uri with jade data repo DEV as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://jade.datarepo-dev.broadinstitute.org/973b5e79-6433-40ce-bf38-686ab7f17820'),
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test.serial('martha_v3 should parse Data Object uri with jade data repo DEV as host and path with snapshot id', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://jade.datarepo-dev.broadinstitute.org/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'),
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test.serial('martha_v3 should parse Data Object uri with jade data repo PROD as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://data.terra.bio/anything'),
        'https://data.terra.bio/ga4gh/drs/v1/objects/anything'
    );
});

test.serial('martha_v3 should parse Data Object uri with host that looks like jade data repo host', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://jade-data-repo.datarepo-dev.broadinstitute.org/v1_anything'),
        'https://jade-data-repo.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_anything'
    );
});
/**
 * End Scenario 4
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 5: data objects uri with the AnVIL data repo host
 *
 * TODO: Test prod expansion of compact identifiers
 */
test.serial('martha_v3 should parse Data Object uri with the AnVIL prefix dg.ANV0', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0'),
        `https://${config.HOST_THE_ANVIL_STAGING}/ga4gh/drs/v1/objects/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`,
    );
});

test.serial('martha_v3 should parse Data Object uri with the AnVIL prod host', (t) => {
    t.is(
        determineDrsTypeTestWrapper(`drs://${config.HOST_THE_ANVIL_PROD}/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`),
        `https://${config.HOST_THE_ANVIL_PROD}/ga4gh/drs/v1/objects/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`
    );
});

test.serial('martha_v3 should parse Data Object uri with the AnVIL staging host', (t) => {
    t.is(
        determineDrsTypeTestWrapper(`drs://${config.HOST_THE_ANVIL_STAGING}/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`),
        `https://${config.HOST_THE_ANVIL_STAGING}/ga4gh/drs/v1/objects/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`,
    );
});

/**
 * End Scenario 5
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 6: data objects uri with the Kids First
 *
 * TODO: Test prod expansion of compact identifiers
 */
test.serial('martha_v3 should parse Data Object uri with the Kids First prefix dg.F82A1A', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://dg.F82A1A/ed6be7ab-068e-46c8-824a-f39cfbb885cc'),
        `https://${config.HOST_KIDS_FIRST_STAGING}/ga4gh/dos/v1/dataobjects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

test.serial('martha_v3 should parse Data Object uri with the Kids First prod repo as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper(`drs://${config.HOST_KIDS_FIRST_PROD}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`),
        `https://${config.HOST_KIDS_FIRST_PROD}/ga4gh/dos/v1/dataobjects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

test.serial('martha_v3 should parse Data Object uri with the Kids First staging repo as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper(`drs://${config.HOST_KIDS_FIRST_STAGING}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`),
        `https://${config.HOST_KIDS_FIRST_STAGING}/ga4gh/dos/v1/dataobjects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

/**
 * End Scenario 6
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 7: data objects uri with CRDC
 *
 * TODO: Test prod expansion of compact identifiers
 */
test.serial('martha_v3 should parse Data Object uri with CRDC prefix dg.4DFC', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://dg.4DFC/ed6be7ab-068e-46c8-824a-f39cfbb885cc'),
        `https://${config.HOST_CRDC_STAGING}/ga4gh/drs/v1/objects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

test.serial('martha_v3 should parse Data Object uri with CRDC prod repo as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper(`drs://${config.HOST_CRDC_PROD}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`),
        `https://${config.HOST_CRDC_PROD}/ga4gh/drs/v1/objects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

test.serial('martha_v3 should parse Data Object uri with CRDC staging repo as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper(`drs://${config.HOST_CRDC_STAGING}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`),
        `https://${config.HOST_CRDC_STAGING}/ga4gh/drs/v1/objects/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    );
});

/**
 * End Scenario 7
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 8: data objects uri with BDC
 *
 * TODO: Test prod expansion of compact identifiers
 */
test.serial('martha_v3 should parse Data Object uri with BDC prefix dg.712C', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://dg.712C/fc046e84-6cf9-43a3-99cc-ffa2964b88cb'),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects/dg.712C/fc046e84-6cf9-43a3-99cc-ffa2964b88cb`,
    );
});

test.serial('martha_v3 should parse Data Object uri with BDC prod repo as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper(`drs://${config.HOST_BIODATA_CATALYST_PROD}/fc046e84-6cf9-43a3-99cc-ffa2964b88cb`),
        `https://${config.HOST_BIODATA_CATALYST_PROD}/ga4gh/drs/v1/objects/fc046e84-6cf9-43a3-99cc-ffa2964b88cb`,
    );
});

test.serial('martha_v3 should parse Data Object uri with BDC staging repo as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper(`drs://${config.HOST_BIODATA_CATALYST_STAGING}/fc046e84-6cf9-43a3-99cc-ffa2964b88cb`),
        `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/drs/v1/objects/fc046e84-6cf9-43a3-99cc-ffa2964b88cb`,
    );
});

/**
 * End Scenario 8
 */
