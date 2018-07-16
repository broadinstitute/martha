/**
 * When writing/testing GCF functions, see:
 * - https://cloud.google.com/functions/docs/monitoring/error-reporting
 * - https://cloud.google.com/functions/docs/bestpractices/testing
 *
 */

const test = require(`ava`);
const sinon = require(`sinon`);
const martha_v2 = require('../martha_v2').martha_v2_handler;
const api_adapters = require('../api_adapter');

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

const dos_object = {fake: "A fake dos object"};
const google_sa_key_object = {key: "A Google Service Account private key json object"};

const dos_method_name = 'resolve_dos';
const bond_method_name = 'talk_to_bond';
let dos_stub;
let bond_stub;
let sandbox = sinon.createSandbox();

test.serial.beforeEach(t => {
    dos_stub = sandbox.stub(api_adapters, dos_method_name).resolves(dos_object);
    bond_stub = sandbox.stub(api_adapters, bond_method_name).resolves(google_sa_key_object);
});

test.serial.afterEach(t => {
    sandbox.restore();
});

test.serial('martha_v2 resolves a valid url into a dos object and google service account key', async t => {
    const response = mockResponse();
    await martha_v2(mockRequest({body: {"url" : "https://example.com/validGS"}}), response);
    const result = response.send.lastCall.args[0];
    t.is(result.dos, dos_object);
    t.is(result.googleServiceAccount, google_sa_key_object);
    t.is(response.statusCode, 200);
});

test.serial('martha_v2 resolves successfully and ignores extra data submitted besides a "url"', async t => {
    const response = mockResponse();
    await martha_v2(mockRequest({body: {url : "https://example.com/validGS", pattern: "gs://", foo: "bar"}}), response);
    const result = response.send.lastCall.args[0];
    t.is(result.dos, dos_object);
    t.is(result.googleServiceAccount, google_sa_key_object);
    t.is(response.statusCode, 200);
});

test.serial('martha_v2 should return 400 if not given a url', async t => {
    const response = mockResponse();
    await martha_v2(mockRequest({body: {"uri" : "https://example.com/validGS"}}), response);
    t.is(response.statusCode, 400);
});

test.serial('martha_v2 should return 502 if dos resolution fails', async t => {
    dos_stub.restore();
    sandbox.stub(api_adapters, dos_method_name).rejects(new Error("DOS Resolution forced to fail by testing stub"));
    const response = mockResponse();
    await martha_v2(mockRequest({body: {"url" : "https://example.com/validGS"}}), response);
    const result = response.send.lastCall.args[0];
    t.true(result instanceof Error);
    t.is(response.statusCode, 502);
});

test.serial('martha_v2 should return 502 if key retrieval from bond fails', async t => {
    bond_stub.restore();
    sandbox.stub(api_adapters, bond_method_name).rejects(new Error("Bond key lookup forced to fail by testing stub"));
    const response = mockResponse();
    await martha_v2(mockRequest({body: {"url" : "https://example.com/validGS"}}), response);
    const result = response.send.lastCall.args[0];
    t.true(result instanceof Error);
    t.is(response.statusCode, 502);
});
