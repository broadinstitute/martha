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
    expectedObjWithMissingFields
} = require('./_martha_v3_resources.js');

const test = require('ava');
const sinon = require('sinon');
const { marthaV3Handler: marthaV3, determineDrsType } = require('../../martha/martha_v3');
const apiAdapter = require('../../common/api_adapter');
const config = require('../../config.json');

const mockRequest = (req) => {
    req.method = 'POST';
    req.headers = { authorization: 'bearer abc123' };
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

const bondRegEx = /^https:\/\/([^/]+)\/api\/link\/v1\/([a-z-]+)\/serviceaccount\/key$/;

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

test.serial('martha_v3 resolves a valid DOS-style url', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledTwice); // Bond was called to get SA key
    t.deepEqual({ ...result }, sampleDosMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
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
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
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
    t.is(result.response.text, 'Request is invalid. URL of a DRS object is missing.');
});

test.serial('martha_v3 should return 400 if no data is posted with the request', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({}), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. URL of a DRS object is missing.');
});

test.serial('martha_v3 should return 400 if given a \'url\' with an invalid value', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { url: 'Not a valid URI' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, 'Invalid URL: Not a valid URI');
});

test.serial('martha_v3 should return 500 if Data Object resolution fails', async (t) => {
    getJsonFromApiStub.restore();
    sandbox.stub(apiAdapter, getJsonFromApiMethodName).rejects(new Error('Data Object Resolution forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 500);
    t.is(result.status, 500);
    t.is(result.response.text, 'Received error while resolving DRS URL. Data Object Resolution forced to fail by testing stub');
});

test.serial('martha_v3 should return 500 if key retrieval from bond fails', async (t) => {
    getJsonFromApiStub.restore();
    sandbox.stub(apiAdapter, getJsonFromApiMethodName).rejects(new Error('Bond key lookup forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 500);
    t.is(result.status, 500);
    t.is(result.response.text, 'Received error while resolving DRS URL. Bond key lookup forced to fail by testing stub');
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

test.serial('martha_v3 does not call Bond or return SA key when the Data Object URL host endswith ".humancellatlas.org', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://someservice.humancellatlas.org/this_part_can_be_anything' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual({ ...result }, sampleDosMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
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
});

test.serial('martha_v3 parses Gen3 CRDC response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(gen3CrdcResponse);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'dos://nci-crdc-staging.datacommons.io/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc' } }),
        response,
    );
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual({ ...result }, gen3CrdcDrsMarthaResult);
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses BDC response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(bdcDrsResponse);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.4503/fc046e84-6cf9-43a3-99cc-ffa2964b88cb' } }),
        response,
    );
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledTwice); // Bond was called to get SA key
    t.deepEqual({ ...result }, bdcDrsMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 parses Anvil response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(anvilDrsResponse);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0' } }),
        response,
    );
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledTwice); // Bond was called to get SA key
    t.deepEqual({ ...result }, anvilDrsMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'anvil';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 parses Kids First response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(kidsFirstDrsResponse);
    const response = mockResponse();
    await marthaV3(
        mockRequest({ body: { 'url': 'drs://data.kidsfirstdrc.org/ed6be7ab-068e-46c8-824a-f39cfbb885cc' } }),
        response
    );
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledTwice); // Bond was called to get SA key
    t.deepEqual({ ...result }, kidsFirstDrsMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
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
                        'dos://drs.data.humancellatlas.org/4bb2740b-e6b2-4c99-824e-6963d505cda0' +
                        '?version=2019-05-15T210546.628682Z'
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
});

test.serial('martha_v3 returns null for fields missing in drs and bond response', async (t) => {
    // update the stub to return DRS response with missing fields only for this test
    sandbox.restore();
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    getJsonFromApiStub = sandbox.stub(apiAdapter, getJsonFromApiMethodName);
    getJsonFromApiStub.onFirstCall().resolves(dosObjectWithMissingFields);
    getJsonFromApiStub.onSecondCall().resolves(null);

    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual({ ...result }, expectedObjWithMissingFields);
    t.is(response.statusCode, 200);
});

function generateUrl(testUrl) {
    const parsedUrl = new URL(testUrl);
    return determineDrsType(parsedUrl).urlGenerator(parsedUrl);
}

/**
 * determineDrsType(uri) -> drsUrl Scenario 1: data objects uri with non-dg host and path
 */
test('determineDrsType should parse dos:// Data Object uri', (t) => {
    t.is(generateUrl('dos://fo.o/bar'), 'https://fo.o/ga4gh/dos/v1/dataobjects/bar');
});

test('determineDrsType should parse drs:// Data Object uri', (t) => {
    t.is(generateUrl('drs://fo.o/bar'), 'https://fo.o/ga4gh/dos/v1/dataobjects/bar');
});

test('determineDrsType should parse drs:// Data Object uri with query part', (t) => {
    t.is(
        generateUrl('drs://fo.o/bar?version=1&bananas=yummy'),
        'https://fo.o/ga4gh/dos/v1/dataobjects/bar?version=1&bananas=yummy'
    );
});

test('determineDrsType should parse drs:// Data Object uri when host includes a port number', (t) => {
    t.is(
        generateUrl('drs://foo.com:1234/bar'),
        'https://foo.com:1234/ga4gh/dos/v1/dataobjects/bar'
    );
});
/**
 * End Scenario 1
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 2: data objects uri with dg host
 */
test('dataObjectUriToHttps should parse "dos://" Data Object uri with a host and path', (t) => {
    t.is(
        generateUrl('dos://dg.2345/bar'),
        `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`
    );
});

test('dataObjectUriToHttps should parse "drs://" Data Object uri with a host and path', (t) => {
    t.is(
        generateUrl('drs://dg.2345/bar'),
        `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`
    );
});

test('dataObjectUriToHttps should parse "drs://dg." Data Object uri with query part', (t) => {
    t.is(
        generateUrl('drs://dg.2345/bar?version=1&bananas=yummy'),
        `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar?version=1&bananas=yummy`
    );
});
/**
 * End Scenario 2
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 3: data objects uri with non-dg host and NO path
 */
test('should parse "dos://dg." Data Object uri with only a host part without a path', (t) => {
    t.is(
        generateUrl('dos://dg.bAz'),
        `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.bAz`
    );
});

test('should parse "drs://foo-bar.baz" Data Object uri with only a host part without a path', (t) => {
    t.is(
        generateUrl('drs://foo-BAR.baz'),
        `https://foo-BAR.baz/ga4gh/dos/v1/dataobjects/foo-BAR.baz`
    );
});

test('should parse "drs://dg." Data Object uri with only a host part with a query part', (t) => {
    t.is(
        generateUrl('drs://dg.foo-bar-baz?version=1&bananas=yummy'),
        `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.foo-bar-baz?version=1&bananas=yummy`
    );
});
/**
 * End Scenario 3
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 4: data objects uri with jade data repo host
 */
test('should parse Data Object uri with jade data repo DEV as host', (t) => {
    t.is(
        generateUrl('drs://jade.datarepo-dev.broadinstitute.org/973b5e79-6433-40ce-bf38-686ab7f17820'),
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test('should parse Data Object uri with jade data repo DEV as host and path with snapshot id', (t) => {
    t.is(
        generateUrl('drs://jade.datarepo-dev.broadinstitute.org/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'),
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test('should parse Data Object uri with jade data repo PROD as host', (t) => {
    t.is(
        generateUrl('drs://jade-terra.datarepo-prod.broadinstitute.org/anything'),
        'https://jade-terra.datarepo-prod.broadinstitute.org/ga4gh/drs/v1/objects/anything'
    );
});

test('should parse Data Object uri with host that looks like jade data repo host', (t) => {
    t.is(
        generateUrl('drs://jade-data-repo.datarepo-dev.broadinstitute.org/v1_anything'),
        'https://jade-data-repo.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_anything'
    );
});
/**
 * End Scenario 4
 */
