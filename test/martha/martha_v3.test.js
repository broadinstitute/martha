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
    jadeDrsResponse,
    hcaDosMarthaResult,
    hcaDosResponse,
    bdcDrsMarthaResult,
    bdcDrsResponse,
    kidsFirstDrsResponse,
    anvilDrsMarthaResult,
    anvilDrsResponse,
    gen3CrdcDrsMarthaResult,
    gen3CrdcResponse,
    sampleDosMarthaResult,
    jadeDrsMarthaResult,
    kidsFirstDrsMarthaResult,
    dosObjectWithMissingFields,
    expectedObjWithMissingFields
} = require('./_martha_v3_resources.js');

const test = require('ava');
const sinon = require('sinon');
const url = require('url');
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

const bondRegEx = /^([^/]+)\/api\/link\/v1\/([a-z-]+)\/serviceaccount\/key$/;

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
    t.deepEqual(Object.assign({}, result), sampleDosMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 resolves a valid DRS-style url', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(sampleDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(Object.assign({}, result), sampleDosMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
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
    t.deepEqual(Object.assign({}, result), sampleDosMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
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
    t.is(result.response.text, '"Not a valid URI" is not a properly-formatted URI.');
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
    t.deepEqual(Object.assign({}, result), sampleDosMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 does not call Bond or return SA key when the host url is for jade data repo', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDrsResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), jadeDrsMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses Gen3 CRDC response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(gen3CrdcResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://nci-crdc.datacommons.io/asdfasdfasdf' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), gen3CrdcDrsMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses BDC response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(bdcDrsResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), bdcDrsMarthaResult);
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses Anvil response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(anvilDrsResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), anvilDrsMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses Kids First response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(kidsFirstDrsResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), kidsFirstDrsMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses HCA response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(hcaDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://someservice.humancellatlas.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), hcaDosMarthaResult(null));
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
    t.deepEqual(Object.assign({}, result), expectedObjWithMissingFields);
    t.is(response.statusCode, 200);
});


/**
 * determineDrsType(uri) -> drsUrl Scenario 1: data objects uri with non-dg host and path
 */
test('determineDrsType should parse dos:// Data Object uri', (t) => {
    t.is(determineDrsType(url.parse('dos://fo.o/bar')).drsUrl, 'https://fo.o/ga4gh/dos/v1/dataobjects/bar');
});

test('determineDrsType should parse drs:// Data Object uri', (t) => {
    t.is(determineDrsType(url.parse('drs://fo.o/bar')).drsUrl, 'https://fo.o/ga4gh/dos/v1/dataobjects/bar');
});

test('determineDrsType should parse drs:// Data Object uri with query part', (t) => {
    t.is(determineDrsType(url.parse('drs://fo.o/bar?version=1&bananas=yummy')).drsUrl, 'https://fo.o/ga4gh/dos/v1/dataobjects/bar?version=1&bananas=yummy');
});

test('determineDrsType should parse drs:// Data Object uri when host includes a port number', (t) => {
    t.is(determineDrsType(url.parse('drs://foo.com:1234/bar')).drsUrl, 'https://foo.com:1234/ga4gh/dos/v1/dataobjects/bar');
});
/**
 * End Scenario 1
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 2: data objects uri with dg host
 */
test('dataObjectUriToHttps should parse "dos://" Data Object uri with a host and path', (t) => {
    t.is(determineDrsType(url.parse('dos://dg.2345/bar')).drsUrl, `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('dataObjectUriToHttps should parse "drs://" Data Object uri with a host and path', (t) => {
    t.is(determineDrsType(url.parse('drs://dg.2345/bar')).drsUrl, `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('dataObjectUriToHttps should parse "drs://dg." Data Object uri with query part', (t) => {
    t.is(determineDrsType(url.parse('drs://dg.2345/bar?version=1&bananas=yummy')).drsUrl, `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar?version=1&bananas=yummy`);
});
/**
 * End Scenario 2
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 3: data objects uri with non-dg host and NO path
 */
test('should parse "dos://dg." Data Object uri with only a host part without a path', (t) => {
    t.is(determineDrsType(url.parse('dos://dg.baz')).drsUrl, `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.baz`);
});

test('should parse "drs://foo-bar.baz" Data Object uri with only a host part without a path', (t) => {
    t.is(determineDrsType(url.parse('drs://foo-bar.baz')).drsUrl, `https://foo-bar.baz/ga4gh/dos/v1/dataobjects/foo-bar.baz`);
});

test('should parse "drs://dg." Data Object uri with only a host part with a query part', (t) => {
    t.is(determineDrsType(url.parse('drs://dg.foo-bar-baz?version=1&bananas=yummy')).drsUrl, `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.foo-bar-baz?version=1&bananas=yummy`);
});
/**
 * End Scenario 3
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 4: data objects uri with jade data repo host
 */
test('should parse Data Object uri with jade data repo DEV as host', (t) => {
    t.is(
        determineDrsType(url.parse('drs://jade.datarepo-dev.broadinstitute.org/973b5e79-6433-40ce-bf38-686ab7f17820')).drsUrl,
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test('should parse Data Object uri with jade data repo DEV as host and path with snapshot id', (t) => {
    t.is(
        determineDrsType(url.parse('drs://jade.datarepo-dev.broadinstitute.org/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820')).drsUrl,
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test('should parse Data Object uri with jade data repo PROD as host', (t) => {
    t.is(
        determineDrsType(url.parse('drs://jade-terra.datarepo-prod.broadinstitute.org/anything')).drsUrl,
        'https://jade-terra.datarepo-prod.broadinstitute.org/ga4gh/drs/v1/objects/anything'
    );
});

test('should parse Data Object uri with host that looks like jade data repo host', (t) => {
    t.is(
        determineDrsType(url.parse('drs://jade-data-repo.datarepo-dev.broadinstitute.org/v1_anything')).drsUrl,
        'https://jade-data-repo.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_anything'
    );
});
/**
 * End Scenario 4
 */
