/**
 * When writing/testing GCF functions, see:
 * - https://cloud.google.com/functions/docs/monitoring/error-reporting
 * - https://cloud.google.com/functions/docs/bestpractices/testing
 *
 * NOTE: Any tests in this file that rely on the before/after stubs need to be run sequentially, see:
 * https://github.com/avajs/ava/issues/1066
 */

const test = require('ava');
const sinon = require('sinon');
const marthaV2 = require('../../martha/martha_v2').marthaV2Handler;
const apiAdapter = require('../../common/api_adapter');

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

const dataObject = { fake: 'A fake Data Object' };
const googleSAKeyObject = { key: 'A Google Service Account private key json object' };

const bondRegEx = /^([^/]+)\/api\/link\/v1\/([a-z-]+)\/serviceaccount\/key$/;

let getJsonFromApiStub;
const getJsonFromApiMethodName = 'getJsonFrom';
const sandbox = sinon.createSandbox();

test.serial.beforeEach(() => {
    sandbox.restore(); // If one test fails, the .afterEach() block will not execute, so always clean the slate here
    getJsonFromApiStub = sandbox.stub(apiAdapter, getJsonFromApiMethodName);
    getJsonFromApiStub.onFirstCall().resolves(dataObject);
    getJsonFromApiStub.onSecondCall().resolves(googleSAKeyObject);
});

test.serial.afterEach(() => {
    sandbox.restore();
});

test.serial('martha_v2 resolves a valid url into a Data Object and google service account key', async (t) => {
    const response = mockResponse();
    await marthaV2(mockRequest({ body: { 'url': 'https://example.com/validGS' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(result.dos, dataObject);
    t.deepEqual(result.googleServiceAccount, googleSAKeyObject);
    t.is(response.statusCode, 200);
});

test.serial('martha_v2 resolves successfully and ignores extra data submitted besides a \'url\'', async (t) => {
    const response = mockResponse();
    await marthaV2(mockRequest({
        body: {
            url: 'https://example.com/validGS',
            pattern: 'gs://',
            foo: 'bar'
        }
    }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(result.dos, dataObject);
    t.deepEqual(result.googleServiceAccount, googleSAKeyObject);
    t.is(response.statusCode, 200);
});

test.serial('martha_v2 resolves a valid url into a Data Object without a service account key if no authorization header is provided', async (t) => {
    const response = mockResponse();
    const mockReq = mockRequest({ body: { 'url': 'https://example.com/validGS' } });
    delete mockReq.headers.authorization;
    await marthaV2(mockReq, response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 200);
    t.deepEqual(result.dos, dataObject);
});

test.serial('martha_v2 should return 400 if not given a url', async (t) => {
    const response = mockResponse();
    await marthaV2(mockRequest({ body: { 'uri': 'https://example.com/validGS' } }), response);
    t.is(response.statusCode, 400);
});

test.serial('martha_v2 should return 400 if no data is posted with the request', async (t) => {
    const response = mockResponse();
    await marthaV2(mockRequest({}), response);
    t.is(response.statusCode, 400);
});

test.serial('martha_v2 should return 400 if given a \'url\' with an invalid value', async (t) => {
    const response = mockResponse();
    await marthaV2(mockRequest({ body: { url: 'Not a valid URI' } }), response);
    t.is(response.statusCode, 400);
});

test.serial('martha_v2 should return 502 if Data Object resolution fails', async (t) => {
    getJsonFromApiStub.restore();
    sandbox.stub(apiAdapter, getJsonFromApiMethodName).rejects(new Error('Data Object Resolution forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV2(mockRequest({ body: { 'url': 'https://example.com/validGS' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(result instanceof Error);
    t.is(response.statusCode, 502);
});

test.serial('martha_v2 should return 502 if key retrieval from bond fails', async (t) => {
    getJsonFromApiStub.restore();
    sandbox.stub(apiAdapter, getJsonFromApiMethodName).rejects(new Error('Bond key lookup forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV2(mockRequest({ body: { 'url': 'https://example.com/validGS' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(result instanceof Error);
    t.is(response.statusCode, 502);
});

test.serial('martha_v2 calls bond Bond with the "dcf-fence" provider when the Data Object URL host is not "dg.4503"', async (t) => {
    const response = mockResponse();
    await marthaV2(mockRequest({ body: { 'url': 'https://example.com/validGS' } }), response);
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v2 calls bond Bond with the "fence" provider when the Data Object URL host is "dg.4503"', async (t) => {
    const response = mockResponse();
    await marthaV2(mockRequest({ body: { 'url': 'drs://dg.4503/this_part_can_be_anything' } }), response);
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v2 does not call Bond or return SA key when the Data Object URL host endswith ".humancellatlas.org', async (t) => {
    const response = mockResponse();
    await marthaV2(mockRequest({ body: { 'url': 'drs://someservice.humancellatlas.org/this_part_can_be_anything' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(result.dos, dataObject);
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});
