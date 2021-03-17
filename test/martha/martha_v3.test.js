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
    hcaDosMarthaResult,
    hcaDosResponse,
    bdcDrsMarthaResult,
    bdcDrsResponse,
    kidsFirstDrsResponse,
    kidsFirstDrsMarthaResult,
    anvilDrsMarthaResult,
    anvilDrsResponse,
    gen3CrdcDrsMarthaResult,
    gen3CrdcResponse,
    dosObjectWithMissingFields,
    dosObjectWithInvalidFields,
    expectedObjWithMissingFields
} = require('./_martha_v3_resources.js');

const test = require('ava');
const sinon = require('sinon');
const {
    marthaV3Handler: marthaV3,
    determineDrsType,
    httpsUrlGenerator,
    allMarthaFields,
} = require('../../martha/martha_v3');
const apiAdapter = require('../../common/api_adapter');
const config = require('../../common/config');
const mask = require('json-mask');

const mockRequest = (req, requestFields = allMarthaFields) => {
    req.method = 'POST';
    req.headers = { authorization: 'bearer abc123' };
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

const drsSignedUrlResponse = { url: 'an-example-url' };

const bondRegEx = /^https:\/\/([^/]+)\/api\/link\/v1\/([a-z-]+)\/serviceaccount\/key$/;

const bondAccessTokenRegEx = /^https:\/\/([^/]+)\/api\/link\/v1\/([a-z-]+)\/accesstoken$/;

let getJsonFromApiStub;
const getJsonFromApiMethodName = 'getJsonFrom';
const sandbox = sinon.createSandbox();

test.serial.beforeEach(() => {
    sandbox.restore(); // If one test fails, the .afterEach() block will not execute, so always clean the slate here
    getJsonFromApiStub = sandbox.stub(apiAdapter, getJsonFromApiMethodName);
    getJsonFromApiStub.onSecondCall().resolves(googleSAKeyObject);
});

test.serial.afterEach(() => {
    sandbox.restore();
});

// Test the "default" case because we don't know who you are.
test.serial('martha_v3 resolves a valid DOS-style url', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(getJsonFromApiStub.callCount, 2); // Bond was called to get SA key
    t.deepEqual({ ...result }, sampleDosMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://abc/ga4gh/dos/v1/dataobjects/123',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

// According to the DRS specification authors [0] it's OK for a client to call Martha with a `drs://` URI and get
// back a DOS object. Martha should just "do the right thing" and return whichever format the server supports,
// instead of erroring out with a 404 due the URI not being found [1].
//
// [0] https://ucsc-cgl.atlassian.net/browse/AZUL-702
// [1] https://broadinstitute.slack.com/archives/G011ZUKHCUX/p1597694952108600
test.serial('martha_v3 resolves a valid DRS-style url', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledTwice); // Bond was called to get SA key
    t.deepEqual({ ...result }, sampleDosMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://abc/ga4gh/dos/v1/dataobjects/123',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 resolves successfully and ignores extra data submitted besides a \'url\'', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            pattern: 'gs://',
            foo: 'bar'
        }
    }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledTwice); // Bond was called to get SA key
    t.deepEqual({ ...result }, sampleDosMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://abc/ga4gh/dos/v1/dataobjects/123',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 does not call Bond when only DRS fields are requested', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            fields: ['gsUri', 'size', 'hashes', 'timeUpdated', 'fileName'],
        }
    }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(
        { ...result },
        mask(sampleDosMarthaResult(googleSAKeyObject), 'gsUri,size,hashes,timeUpdated,fileName'),
    );
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://abc/ga4gh/dos/v1/dataobjects/123',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
});

test.serial('martha_v3 does not call DRS when only Bond fields are requested', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            fields: ['googleServiceAccount'],
        }
    }), response);
    // TODO: Move all status code checks directly after call to marthaV3()
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    // TODO: Use sinon.assert instead of .calledOnce AND .callCount() (or whatever it was called)
    sinon.assert.callCount(getJsonFromApiStub, 1); // DRS was not called
    t.deepEqual(
        { ...result },
        mask(sampleDosMarthaResult(googleSAKeyObject), 'googleServiceAccount'),
    );
    const requestedBondUrl = getJsonFromApiStub.firstCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 calls no endpoints when no fields are requested', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            fields: [],
        }
    }), response);
    t.true(getJsonFromApiStub.notCalled); // Neither Bond nor DRS was called
    const result = response.send.lastCall.args[0];
    t.deepEqual({ ...result }, {});
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 returns an error when fields is not an array', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            fields: 'gsUri',
        }
    }), response);
    t.true(getJsonFromApiStub.notCalled); // Neither Bond nor DRS was called
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
    t.is(response.statusCode, 400);
});

test.serial('martha_v3 returns an error when an invalid field is requested', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            fields: ['gsUri', 'size', 'hashes', 'timeUpdated', 'fileName', 'googleServiceAccount', 'meaningOfLife'],
        }
    }), response);
    t.true(getJsonFromApiStub.notCalled); // Neither Bond nor DRS was called
    const result = response.send.lastCall.args[0];
    t.deepEqual(
        { ...result },
        {
            response: {
                status: 400,
                text:
                    "Request is invalid. Fields 'meaningOfLife' are not supported. Supported fields are " +
                    "'gsUri', 'bucket', 'name', 'fileName', 'contentType', 'size', 'hashes', " +
                    "'timeCreated', 'timeUpdated', 'googleServiceAccount', 'bondProvider', 'signedUrl'.",
            },
            status: 400,
        },
    );
    t.is(response.statusCode, 400);
});

test.serial('martha_v3 should return 400 if a Data Object without authorization header is provided', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    const mockReq = mockRequest({ body: { 'url': 'dos://abc/123' } });
    delete mockReq.headers.authorization;
    await marthaV3(mockReq, response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. Authorization header is missing.');
});

test.serial('martha_v3 should return 400 if not given a url', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'uri': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, "Request is invalid. 'url' is missing.");
});

test.serial('martha_v3 should return 400 if given a dg URL without a path', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://dg.abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. "dos://dg.abc" is missing a host and/or a path.');
});

test.serial('martha_v3 should return 400 if given a dg URL with only a path', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos:///dg.abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. "dos:///dg.abc" is missing a host and/or a path.');
});

test.serial('martha_v3 should return 400 if no data is posted with the request', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({}), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, "Request is invalid. 'url' is missing.");
});

test.serial('martha_v3 should return 400 if given a \'url\' with an invalid value', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { url: 'Not a valid URI' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. Invalid URL: Not a valid URI');
});

test.serial('martha_v3 should return 500 if Data Object resolution fails', async (t) => {
    getJsonFromApiStub.onFirstCall().rejects(new Error('Data Object Resolution forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 500);
    t.is(result.status, 500);
    t.is(result.response.text, 'Received error while resolving DRS URL. Data Object Resolution forced to fail by testing stub');
});

test.serial('martha_v3 should return the underlying status if Data Object resolution fails', async (t) => {
    const error = new Error('Data Object Resolution forced to fail by testing stub');
    error.status = 418;
    getJsonFromApiStub.onFirstCall().rejects(error);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 418);
    t.is(result.status, 418);
    t.is(
        result.response.text,
        'Received error while resolving DRS URL. Data Object Resolution forced to fail by testing stub',
    );
});

test.serial('martha_v3 should return 500 if key retrieval from Bond fails', async (t) => {
    getJsonFromApiStub.onSecondCall().rejects(new Error('Bond key lookup forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 500);
    t.is(result.status, 500);
    t.is(result.response.text, 'Received error contacting Bond. Bond key lookup forced to fail by testing stub');
});

test.serial('martha_v3 calls bond Bond with the "dcf-fence" provider when the Data Object URL host is not "dg.4503"', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 calls bond Bond with the "fence" provider when the Data Object URL host is "dg.4503"', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://dg.4503/this_part_can_be_anything' } }), response);
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial(
    'martha_v3 does call Bond and return SA key when the host url is for dataguids.org',
    async (t) => {
        getJsonFromApiStub.onFirstCall().resolves(dataGuidsOrgResponse);
        const response = mockResponse();
        await marthaV3(
            mockRequest({ body: { 'url': 'dos://dataguids.org/a41b0c4f-ebfb-4277-a941-507340dea85d' } }),
            response
        );
        const result = response.send.lastCall.args[0];
        t.true(getJsonFromApiStub.calledTwice); // Bond was called to get SA key
        t.deepEqual({ ...result }, dataGuidsOrgMarthaResult(googleSAKeyObject));
        t.is(response.statusCode, 200);
        t.is(
            getJsonFromApiStub.firstCall.args[0],
            'https://dataguids.org/ga4gh/dos/v1/dataobjects/a41b0c4f-ebfb-4277-a941-507340dea85d',
        );
        t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
        const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
        const matches = requestedBondUrl.match(bondRegEx);
        t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
        const expectedProvider = 'dcf-fence';
        const actualProvider = matches[2];
        t.is(actualProvider, expectedProvider);
    }
);

test.serial('martha_v3 does not call Bond or return SA key when the host url is for jade data repo', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDrsResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual({ ...result }, jadeDrsMarthaResult);
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/abc',
    );
    t.is(getJsonFromApiStub.firstCall.args[1], 'bearer abc123');
});

test.serial('martha_v3 parses Gen3 CRDC response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(gen3CrdcResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(drsSignedUrlResponse);
    getJsonFromApiStub.onCall(3).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'dos://nci-crdc-staging.datacommons.io/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc' } }),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 4);
    t.deepEqual({ ...result }, gen3CrdcDrsMarthaResult(googleSAKeyObject));
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://nci-crdc-staging.datacommons.io/ga4gh/drs/v1/objects/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
    const requestedBondUrl = getJsonFromApiStub.getCall(3).args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 parses a Gen3 CRDC CIB URI response correctly', async (t) => {
    // getJsonFromApiStub.onFirstCall().resolves(gen3CrdcResponse);
    getJsonFromApiStub.onCall(0).resolves(gen3CrdcResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(drsSignedUrlResponse);
    getJsonFromApiStub.onCall(3).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'dos://dg.4DFC:206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc' } }),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 4);
    t.deepEqual({ ...result }, gen3CrdcDrsMarthaResult(googleSAKeyObject));
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://nci-crdc.datacommons.io/ga4gh/drs/v1/objects/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
    const requestedBondUrl = getJsonFromApiStub.getCall(3).args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 parses BDC response correctly', async (t) => {
    // Rotated once from Michael Baumann's sequence diagram so that call 0 is the second call down from the top,
    // call 3 is the top call.
    // https://lucid.app/lucidchart/428a0bdd-a884-4fc7-9a49-7bf300ef6777/edit?shared=true&page=0_0#
    getJsonFromApiStub.onCall(0).resolves(bdcDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(drsSignedUrlResponse);
    getJsonFromApiStub.onCall(3).resolves(googleSAKeyObject);

    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0' } }),
        response,
    );
    const result = response.send.lastCall.args[0];
    // Bond was called twice to get SA key and access token.
    // DRS server was called twice to get DRS response and signed URL.
    // 2 + 2 = 4.
    sinon.assert.callCount(getJsonFromApiStub, 4);

    t.deepEqual({ ...result }, bdcDrsMarthaResult(googleSAKeyObject, drsSignedUrlResponse.url));
    t.is(response.statusCode, 200);

    t.is(
        getJsonFromApiStub.getCall(0).args[0],
        'https://staging.gen3.biodatacatalyst.nhlbi.nih.gov/ga4gh/drs/v1/objects' +
        '/dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0',
    );
    t.falsy(getJsonFromApiStub.getCall(0).args[1]); // no auth passed

    const requestedBondAccessToken = getJsonFromApiStub.getCall(1).args[0];
    const accessTokenMatches = requestedBondAccessToken.match(bondAccessTokenRegEx);
    t.truthy(accessTokenMatches, 'Bond access token URL called does not match Bond access token URL regular expression');
    const expectedAccessTokenProvider = 'fence';
    const actualAccessTokenProvider = accessTokenMatches[2];
    t.is(actualAccessTokenProvider, expectedAccessTokenProvider);

    t.is(
        getJsonFromApiStub.getCall(2).args[0],
        'https://staging.gen3.biodatacatalyst.nhlbi.nih.gov/ga4gh/drs/v1/objects' +
        '/dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0/access/gs',
    );
    t.is(getJsonFromApiStub.getCall(2).args[1], `Bearer ${bondAccessTokenResponse.token}`);

    const requestedBondUrl = getJsonFromApiStub.getCall(3).args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 parses BDC staging response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(bdcDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(drsSignedUrlResponse);
    getJsonFromApiStub.onCall(3).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.712C/fc046e84-6cf9-43a3-99cc-ffa2964b88cb' } }),
        response,
    );
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 4);
    t.deepEqual({ ...result }, bdcDrsMarthaResult(googleSAKeyObject, drsSignedUrlResponse.url));
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://staging.gen3.biodatacatalyst.nhlbi.nih.gov/ga4gh/drs/v1/objects' +
        '/dg.712C/fc046e84-6cf9-43a3-99cc-ffa2964b88cb',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
    const requestedBondUrl = getJsonFromApiStub.getCall(3).args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 parses Anvil response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(anvilDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(drsSignedUrlResponse);
    getJsonFromApiStub.onCall(3).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0' } }),
        response,
    );
    t.is(response.statusCode, 200);

    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 4); // Bond was called to get SA key
    t.deepEqual({ ...result }, anvilDrsMarthaResult(googleSAKeyObject, drsSignedUrlResponse.url));
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://gen3.theanvil.io/ga4gh/drs/v1/objects/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
    const requestedBondUrl = getJsonFromApiStub.getCall(3).args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'anvil';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 parses a The AnVIL CIB URI response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(anvilDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(bondAccessTokenResponse);
    getJsonFromApiStub.onCall(2).resolves(drsSignedUrlResponse);
    getJsonFromApiStub.onCall(3).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.ANV0:dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0' } }),
        response,
    );
    t.is(response.statusCode, 200);

    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 4); // Bond was called to get SA key
    t.deepEqual({ ...result }, anvilDrsMarthaResult(googleSAKeyObject, drsSignedUrlResponse.url));
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://gen3.theanvil.io/ga4gh/drs/v1/objects/dg.ANV0%2F00008531-03d7-418c-b3d3-b7b22b5381a0',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
    const requestedBondUrl = getJsonFromApiStub.getCall(3).args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'anvil';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 parses Kids First response correctly', async (t) => {
    getJsonFromApiStub.onCall(0).resolves(kidsFirstDrsResponse);
    getJsonFromApiStub.onCall(1).resolves(googleSAKeyObject);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://data.kidsfirstdrc.org/ed6be7ab-068e-46c8-824a-f39cfbb885cc' } }),
        response
    );
    t.is(response.statusCode, 200);

    const result = response.send.lastCall.args[0];
    sinon.assert.callCount(getJsonFromApiStub, 2); // Bond was called to get SA key
    t.deepEqual({ ...result }, kidsFirstDrsMarthaResult(googleSAKeyObject));
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://data.kidsfirstdrc.org/ga4gh/dos/v1/dataobjects/ed6be7ab-068e-46c8-824a-f39cfbb885cc',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
    const requestedBondUrl = getJsonFromApiStub.getCall(1).args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
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
        getJsonFromApiStub.firstCall.args[0],
        'https://data.kidsfirstdrc.org/ga4gh/dos/v1/dataobjects/ed6be7ab-068e-46c8-824a-f39cfbb885cc',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
    const requestedBondUrl = getJsonFromApiStub.getCall(1).args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 parses HCA response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(hcaDosResponse);
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
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual({ ...result }, hcaDosMarthaResult);
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
    t.is(
        getJsonFromApiStub.firstCall.args[0],
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_4641bafb-5190-425b-aea9-9c7b125515c8_e37266ba-790d-4641-aa76-854d94be2fbe',
    );
    t.falsy(getJsonFromApiStub.firstCall.args[1]); // no auth passed
});

test.serial('martha_v3 returns null for fields missing in drs and bond response', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(dosObjectWithMissingFields);
    getJsonFromApiStub.onSecondCall().resolves(null);

    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual({ ...result }, expectedObjWithMissingFields);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 should return 500 if Data Object parsing fails', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(dosObjectWithInvalidFields);
    getJsonFromApiStub.onSecondCall().resolves(null);

    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
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
    t.is(response.statusCode, 500);
});

// Test utility for generating server URL from a DRS URL
function determineDrsTypeTestWrapper(testUrl) {
    const drsType = determineDrsType(testUrl);
    return httpsUrlGenerator(drsType);
}

/**
 * determineDrsType(uri) -> drsUrl Scenario 1: data objects uri with non-dg host and path
 */
test('determineDrsType should parse dos:// Data Object uri', (t) => {
    t.is(determineDrsTypeTestWrapper('dos://fo.o/bar'), 'https://fo.o/ga4gh/dos/v1/dataobjects/bar');
});

test('determineDrsType should parse drs:// Data Object uri', (t) => {
    t.is(determineDrsTypeTestWrapper('drs://fo.o/bar'), 'https://fo.o/ga4gh/dos/v1/dataobjects/bar');
});

test('determineDrsType should parse drs:// Data Object uri with query part', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://fo.o/bar?version=1&bananas=yummy'),
        'https://fo.o/ga4gh/dos/v1/dataobjects/bar?version=1&bananas=yummy'
    );
});

test('determineDrsType should parse drs:// Data Object uri when host includes a port number', (t) => {
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
test('determineDrsType should parse "dos://" Data Object uri with a host and path', (t) => {
    t.is(
        determineDrsTypeTestWrapper('dos://dg.2345/bar'),
        `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`
    );
});

test('determineDrsType should parse "drs://" Data Object uri with a host and path', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://dg.2345/bar'),
        `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`
    );
});

test('determineDrsType should parse "drs://dg." Data Object uri with query part', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://dg.2345/bar?version=1&bananas=yummy'),
        `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar?version=1&bananas=yummy`
    );
});

test('determineDrsType should parse "drs://" Data Object uri with an expanded host and path', (t) => {
    t.is(
        determineDrsTypeTestWrapper(`dos://${config.dataObjectResolutionHost}/dg.2345/bar`),
        `https://${config.dataObjectResolutionHost}/ga4gh/drs/v1/objects/dg.2345/bar`
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
test('should parse Data Object uri with jade data repo DEV as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://jade.datarepo-dev.broadinstitute.org/973b5e79-6433-40ce-bf38-686ab7f17820'),
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test('should parse Data Object uri with jade data repo DEV as host and path with snapshot id', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://jade.datarepo-dev.broadinstitute.org/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'),
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test('should parse Data Object uri with jade data repo PROD as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://data.terra.bio/anything'),
        'https://data.terra.bio/ga4gh/drs/v1/objects/anything'
    );
});

test('should parse Data Object uri with host that looks like jade data repo host', (t) => {
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
 */
test('should parse Data Object uri with the AnVIL prefix dg.ANV0', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0'),
        'https://gen3.theanvil.io/ga4gh/drs/v1/objects/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0',
    );
});

test('should parse Data Object uri with the AnVIL host', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://gen3.theanvil.io/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0'),
        'https://gen3.theanvil.io/ga4gh/drs/v1/objects/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0',
    );
});
/**
 * End Scenario 5
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 6: data objects uri with the Kids First
 */
test('should parse Data Object uri with the Kids First repo as host', (t) => {
    t.is(
        determineDrsTypeTestWrapper('drs://data.kidsfirstdrc.org/ed6be7ab-068e-46c8-824a-f39cfbb885cc'),
        'https://data.kidsfirstdrc.org/ga4gh/dos/v1/dataobjects/ed6be7ab-068e-46c8-824a-f39cfbb885cc',
    );
});
/**
 * End Scenario 6
 */
