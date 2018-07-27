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
const martha_v3 = require('../martha_v3');
const martha_v3_handler = martha_v3.martha_v3_handler;
const apiAdapter = require('../api_adapter');

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

const dosObject = { fake: 'A fake dos object' };
const googleSAKeyObject = { key: 'A Google Service Account private key json object' };
const gsObjectMetadata = {
    contentType: 'application/json',
    size: 1234,
    updated: "Mon, 16 Jul 2018 21:36:14 GMT",
    md5Hash: "abcdefg",
    bucket: "some.fake-location",
    name: "file.txt",
    uri: "gs://some.fake-location/file.txt"
};
// const getGsObjectMetadata

let getJsonFromApiStub;
let getGsObjectMetadataStub;
let getJsonFromApiMethodName = 'getJsonFrom';
let getGsObjectMetadataMethodName = 'getGsObjectMetadata';
let sandbox = sinon.createSandbox();

test.serial.beforeEach(() => {
    sandbox.restore(); // If one test fails, the .afterEach() block will not execute, so always clean the slate here
    getJsonFromApiStub = sandbox.stub(apiAdapter, getJsonFromApiMethodName);
    getJsonFromApiStub.onFirstCall().resolves(dosObject);
    getJsonFromApiStub.onSecondCall().resolves(googleSAKeyObject);
    // getGsObjectMetadataStub = sandbox.stub(martha_v3, getGsObjectMetadataMethodName);
    // getGsObjectMetadataStub.onCall().resolves(gsObjectMetadata);
});

test.serial.afterEach(() => {
    sandbox.restore();
});

// test.serial('martha_v3 resolves a valid dos url into a dos object and signed url', async (t) => {
//     const response = mockResponse();
//     await martha_v3(mockRequest({ body: { 'uri': 'https://example.com/validGS' } }), response);
//     const result = response.send.lastCall.args[0];
//     // console.log(result);
//     t.deepEqual(result.dos, dosObject);
//     t.deepEqual(result.googleServiceAccount, googleSAKeyObject);
//     t.is(response.statusCode, 200);
// });

// test.serial('martha_v2 resolves successfully and ignores extra data submitted besides a \'url\'', async (t) => {
//     const response = mockResponse();
//     await martha_v3(mockRequest({
//         body: {
//             url: 'https://example.com/validGS',
//             pattern: 'gs://',
//             foo: 'bar'
//         }
//     }), response);
//     const result = response.send.lastCall.args[0];
//     t.deepEqual(result.dos, dosObject);
//     t.deepEqual(result.googleServiceAccount, googleSAKeyObject);
//     t.is(response.statusCode, 200);
// });
//
// test.serial('martha_v2 resolves a valid url into a dos object without a service account key if no authorization header is provided', async (t) => {
//     const response = mockResponse();
//     const mockReq = mockRequest({ body: { 'url': 'https://example.com/validGS' } });
//     delete mockReq.headers.authorization;
//     await martha_v3(mockReq, response);
//     const result = response.send.lastCall.args[0];
//     t.is(response.statusCode, 200);
//     t.deepEqual(result.dos, dosObject);
// });

test.serial('martha_v3 should return 400 if not given a url', async (t) => {
    const response = mockResponse();
    await martha_v3_handler(mockRequest({ body: { 'foo': 'bar' } }), response);
    t.is(response.statusCode, 400);
});

test.serial('martha_v3 should return 400 if no data is posted with the request', async (t) => {
    const response = mockResponse();
    await martha_v3_handler(mockRequest({}), response);
    t.is(response.statusCode, 400);
});

test.serial('martha_v3 should return 400 if given a \'uri\' with an invalid value', async (t) => {
    const response = mockResponse();
    // martha_v3.getGsObjectMetadata("foo", "bar");
    // t.is(getGsObjectMetadataStub.callCount, 1);
    await martha_v3_handler(mockRequest({ body: { uri: 'Not a valid URI' } }), response);
    // t.is(getGsObjectMetadataStub.callCount, 2);
    // martha_v3.getGsObjectMetadata("foo", "bar");
    // t.is(getGsObjectMetadataStub.callCount, 3);
    // t.is(getJsonFromApiStub.callCount, 2);
    // console.log(response);
    const result = response.send.lastCall.args[0];
    console.log(result);
    t.is(response.statusCode, 400);
});

// test.serial('martha_v2 should return 502 if dos resolution fails', async (t) => {
//     getJsonFromApiStub.restore();
//     sandbox.stub(apiAdapter, getJsonFromApiMethodName).rejects(new Error('DOS Resolution forced to fail by testing stub'));
//     const response = mockResponse();
//     await martha_v3(mockRequest({ body: { 'url': 'https://example.com/validGS' } }), response);
//     const result = response.send.lastCall.args[0];
//     t.true(result instanceof Error);
//     t.is(response.statusCode, 502);
// });
//
// test.serial('martha_v2 should return 502 if key retrieval from bond fails', async (t) => {
//     getJsonFromApiStub.restore();
//     sandbox.stub(apiAdapter, getJsonFromApiMethodName).rejects(new Error('Bond key lookup forced to fail by testing stub'));
//     const response = mockResponse();
//     await martha_v3(mockRequest({ body: { 'url': 'https://example.com/validGS' } }), response);
//     const result = response.send.lastCall.args[0];
//     t.true(result instanceof Error);
//     t.is(response.statusCode, 502);
// });
