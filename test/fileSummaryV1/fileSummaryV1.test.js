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
const fileSummaryV1 = require('../../fileSummaryV1/fileSummaryV1').fileSummaryV1Handler;
const saKeys = require('../../fileSummaryV1/service_account_keys');
const metadataApi = require('../../fileSummaryV1/metadata_api');
const urlSigner = require('../../fileSummaryV1/urlSigner');
const apiAdapter = require('../../common/api_adapter');
const helpers = require('../../common/helpers');

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

const gsObjectMetadata = () => {
    return helpers.convertToFileInfoResponse(
        'application/json',
        1234,
        undefined,
        'Mon, 16 Jul 2018 21:36:14 GMT',
        'abcdefg',
        'some.fake-location',
        'file.txt',
        'gs://some.fake-location/file.txt',
        null
    );
};

const fakeSignedUrl = 'http://i.am.a.signed.url.com/totallyMadeUp';
const fakeSAKey = {key: 'I am not real'};

const fullExpectedResult = () => {
    return helpers.convertToFileInfoResponse(
      'application/json',
      1234,
      null,
      'Mon, 16 Jul 2018 21:36:14 GMT',
      'abcdefg',
      'some.fake-location',
      'file.txt',
      'gs://some.fake-location/file.txt',
      fakeSignedUrl
    );
};

const getServiceAccountKeyMethodName = 'getServiceAccountKey';
let getServiceAccountKeyStub;
const getMetadataMethodName = 'getMetadata';
let getMetadataStub;
const createSignedUrlMethodName = 'createSignedGsUrl';
let createSignedUrlStub;
let getJsonFromApiMethodName = 'getJsonFrom';
let getJsonFromApiStub;
let sandbox = sinon.createSandbox();

test.serial.beforeEach(() => {
    sandbox.restore(); // If one test fails, the .afterEach() block will not execute, so always clean the slate here
    getServiceAccountKeyStub = sandbox.stub(saKeys, getServiceAccountKeyMethodName);
    getServiceAccountKeyStub.resolves(fakeSAKey);
    getMetadataStub = sandbox.stub(metadataApi, getMetadataMethodName);
    getMetadataStub.returns(gsObjectMetadata());
    createSignedUrlStub = sandbox.stub(urlSigner, createSignedUrlMethodName);
    createSignedUrlStub.returns(fakeSignedUrl);
    getJsonFromApiStub = sandbox.stub(apiAdapter, getJsonFromApiMethodName);
});

test.serial.afterEach(() => {
    sandbox.restore();
});

test.serial('fileSummaryV1Handler resolves a valid gs url into a metadata and signed url', async (t) => {
    const response = mockResponse();
    await fileSummaryV1(mockRequest({ body: { uri: 'gs://example.com/validGS' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(result, fullExpectedResult());
    t.truthy(result.signedUrl);
    t.is(response.statusCode, 200);
});

test.serial('fileSummaryV1Handler resolves a valid drs:// Data Object url into metadata and signed url', async (t) => {
    const response = mockResponse();
    await fileSummaryV1(mockRequest({ body: { uri: 'drs://example.com/validGS' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(result, fullExpectedResult());
    t.truthy(result.signedUrl);
    t.is(response.statusCode, 200);
});

test.serial('fileSummaryV1Handler resolves a valid drs:// Data Object url into metadata with no signed url when not linked to Fence', async (t) => {
    getServiceAccountKeyStub.restore();
    sandbox.stub(saKeys, getServiceAccountKeyMethodName).resolves();
    const response = mockResponse();
    const mockReq = mockRequest({ body: { uri: 'drs://example.com/validGS' } });
    await fileSummaryV1(mockReq, response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(result, gsObjectMetadata());
    t.falsy(result.signedUrl);
    t.is(response.statusCode, 200);
});

test.serial('fileSummaryV1Handler resolves a valid HCA drs:// Data Object url into metadata with no signed url and no SA key', async (t) => {
    getServiceAccountKeyStub.restore();
    sandbox.stub(saKeys, getServiceAccountKeyMethodName).callThrough();
    const response = mockResponse();
    const mockReq = mockRequest({ body: { uri: 'drs://someservice.humancellatlas.org/someObjectId' } });
    await fileSummaryV1(mockReq, response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.notCalled); // Bond was not called to get SA key
    t.deepEqual(result, gsObjectMetadata());
    t.falsy(result.signedUrl);
    t.is(response.statusCode, 200);
});

test.serial('fileSummaryV1Handler returns 401 when no authorization header is provided', async (t) => {
    const response = mockResponse();
    const mockReq = mockRequest({ body: { uri: 'gs://example.com/validGS' } });
    delete mockReq.headers.authorization;
    await fileSummaryV1(mockReq, response);
    t.is(response.statusCode, 401);
});

test.serial('fileSummaryV1Handler should return 400 if not given a url', async (t) => {
    const response = mockResponse();
    await fileSummaryV1(mockRequest({ body: { 'foo': 'bar' } }), response);
    t.is(response.statusCode, 400);
});

test.serial('fileSummaryV1Handler should return 400 if no data is posted with the request', async (t) => {
    const response = mockResponse();
    await fileSummaryV1(mockRequest({}), response);
    t.is(response.statusCode, 400);
});

test.serial('fileSummaryV1Handler should return 400 if given a \'uri\' with an invalid value', async (t) => {
    const response = mockResponse();
    await fileSummaryV1(mockRequest({ body: { uri: 'Not a valid URI' } }), response);
    t.is(response.statusCode, 400);
});

test.serial('fileSummaryV1Handler should return 502 if it is unable to retrieve a service account key', async (t) => {
    getServiceAccountKeyStub.restore();
    sandbox.stub(saKeys, getServiceAccountKeyMethodName).rejects(new Error('Stubbed error getting Service Account Key'));
    const response = mockResponse();
    await fileSummaryV1(mockRequest({ body: { uri: 'drs://example.com/validGS' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(result instanceof Error);
    t.is(response.statusCode, 502);
});

test.serial('fileSummaryV1Handler should return 502 if it is unable to retrieve metadata for the object', async (t) => {
    getMetadataStub.restore();
    sandbox.stub(metadataApi, getMetadataMethodName).rejects(new Error('Stubbed error getting metadata for object'));
    const response = mockResponse();
    await fileSummaryV1(mockRequest({ body: { uri: 'gs://example.com/validGS' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(result instanceof Error);
    t.is(response.statusCode, 502);
});

test.serial('fileSummaryV1Handler should return 502 if it is unable to sign a url for the object', async (t) => {
    createSignedUrlStub.restore();
    sandbox.stub(urlSigner, createSignedUrlMethodName).rejects(new Error('Stubbed error trying to sign url'));
    const response = mockResponse();
    await fileSummaryV1(mockRequest({ body: { uri: 'gs://example.com/validGS' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(result instanceof Error);
    t.is(response.statusCode, 502);
});
