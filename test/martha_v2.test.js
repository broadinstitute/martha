/**
 * When writing/testing GCF functions, see:
 * - https://cloud.google.com/functions/docs/monitoring/error-reporting
 * - https://cloud.google.com/functions/docs/bestpractices/testing
 *
 * NOTE: Any tests in this file that rely on the before/after stubs need to be run sequentially, see:
 * https://github.com/avajs/ava/issues/1066
 */

const test = require("ava");
const sinon = require("sinon");
const martha_v2 = require("../martha_v2").martha_v2_handler;
const apiAdapter = require("../api_adapter");

const mockRequest = (req) => {
    req.method = "POST";
    req.headers = {authorization: "bearer abc123"};
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

const dosObject = {fake: "A fake dos object"};
const googleSAKeyObject = {key: "A Google Service Account private key json object"};

let getTextFromApiStub;
let getTextFromApiMethodName = "getTextFrom";
let sandbox = sinon.createSandbox();

test.serial.beforeEach(t => {
    sandbox.restore(); // If one test fails, the .afterEach() block will not execute, so always clean the slate here
    getTextFromApiStub = sandbox.stub(apiAdapter, getTextFromApiMethodName);
    getTextFromApiStub.onFirstCall().resolves(JSON.stringify(dosObject));
    getTextFromApiStub.onSecondCall().resolves(JSON.stringify(googleSAKeyObject));
});

test.serial.afterEach(t => {
    sandbox.restore();
});

test.serial("martha_v2 resolves a valid url into a dos object and google service account key", async t => {
    const response = mockResponse();
    await martha_v2(mockRequest({body: {"url" : "https://example.com/validGS"}}), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(result.dos, dosObject);
    t.deepEqual(result.googleServiceAccount, googleSAKeyObject);
    t.is(response.statusCode, 200);
});

test.serial("martha_v2 resolves successfully and ignores extra data submitted besides a 'url'", async t => {
    const response = mockResponse();
    await martha_v2(mockRequest({body: {url : "https://example.com/validGS", pattern: "gs://", foo: "bar"}}), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(result.dos, dosObject);
    t.deepEqual(result.googleServiceAccount, googleSAKeyObject);
    t.is(response.statusCode, 200);
});

test.serial("martha_v2 should return 400 if not given a url", async t => {
    const response = mockResponse();
    await martha_v2(mockRequest({body: {"uri" : "https://example.com/validGS"}}), response);
    t.is(response.statusCode, 400);
});

test.serial("martha_v2 should return 400 if given a 'url' with an invalid value", async t => {
    const response = mockResponse();
    await martha_v2(mockRequest({body: {url : "Not a valid URI"}}), response);
    t.is(response.statusCode, 400);
});

test.serial("martha_v2 should return 502 if dos resolution fails", async t => {
    getTextFromApiStub.restore();
    sandbox.stub(apiAdapter, getTextFromApiMethodName).rejects(new Error("DOS Resolution forced to fail by testing stub"));
    const response = mockResponse();
    await martha_v2(mockRequest({body: {"url" : "https://example.com/validGS"}}), response);
    const result = response.send.lastCall.args[0];
    t.true(result instanceof Error);
    t.is(response.statusCode, 502);
});

test.serial("martha_v2 should return 502 if key retrieval from bond fails", async t => {
    getTextFromApiStub.restore();
    sandbox.stub(apiAdapter, getTextFromApiMethodName).rejects(new Error("Bond key lookup forced to fail by testing stub"));
    const response = mockResponse();
    await martha_v2(mockRequest({body: {"url" : "https://example.com/validGS"}}), response);
    const result = response.send.lastCall.args[0];
    t.true(result instanceof Error);
    t.is(response.statusCode, 502);
});
