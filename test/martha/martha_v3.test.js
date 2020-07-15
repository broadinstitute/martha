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
const marthaV3 = require('../../martha/martha_v3').marthaV3Handler;
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

const dataRepositoryServiceObject = {
    id: 'v1_93dc1e76-8f1c-4949-8f9b-07a087f3ce7b_8b07563a-542f-4b5c-9e00-e8fe6b1861de',
    description: 'HG00096 BAM file',
    name: 'HG00096.mapped.ILLUMINA.bwa.GBR.low_coverage.20120522.bam',
    size: 15601108255,
    created_time: '2020-04-27T15:56:09.696Z', // eslint-disable-line camelcase
    updated_time: '2020-04-27T15:56:09.696Z', // eslint-disable-line camelcase
    version: '0',
    mime_type: 'application/octet-stream', // eslint-disable-line camelcase
    checksums: [
        {
            checksum: '336ea55913bc261b72875bd259753046',
            type: 'md5'
        },
        {
            checksum: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44',
            type: 'sha256'
        },
        {
            checksum: '8a366443',
            type: 'crc32c'
        }
    ],
    access_methods: [ // eslint-disable-line camelcase
        {
            type: 'gs',
            access_url: { // eslint-disable-line camelcase
                url:
                    'gs://broad-jade-dev-data-bucket/fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/' +
                    '8b07563a-542f-4b5c-9e00-e8fe6b1861de',
            }
        }
    ]
};

const fullExpectedResult = (expectedGoogleServiceAccount) => {
    return {
        contentType: 'application/octet-stream',
        size: 15601108255,
        timeCreated: '2020-04-27T15:56:09.696Z',
        updated: '2020-04-27T15:56:09.696Z',
        bucket: 'broad-jade-dev-data-bucket',
        name: 'fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/8b07563a-542f-4b5c-9e00-e8fe6b1861de',
        gsUri:
            'gs://broad-jade-dev-data-bucket/fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/8b07563a-542f-4b5c-9e00-e8fe6b1861de',
        googleServiceAccount: expectedGoogleServiceAccount,
        hashes: {
            md5: '336ea55913bc261b72875bd259753046',
            sha256: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44',
            crc32c: '8a366443'
        }
    };
};

const drsObjectWithMissingFields = {
    id: 'v1_abc-123',
    description: '123 BAM file',
    name: '123.mapped.abc.bam',
    created_time: '2020-04-27T15:56:09.696Z',
    version: '0',
    mime_type: 'application/octet-stream',
    size: 123456
};

const expectedObjWithMissingFields = {
    contentType: 'application/octet-stream',
    size: 123456,
    timeCreated: '2020-04-27T15:56:09.696Z',
    updated: null,
    bucket: null,
    name: null,
    gsUri: null,
    googleServiceAccount: null,
    hashes: null
};

const googleSAKeyObject = { key: 'A Google Service Account private key json object' };

const bondRegEx = /^([^/]+)\/api\/link\/v1\/([a-z-]+)\/serviceaccount\/key$/;

let getJsonFromApiStub;
const getJsonFromApiMethodName = 'getJsonFrom';
const sandbox = sinon.createSandbox();

test.serial.beforeEach(() => {
    sandbox.restore(); // If one test fails, the .afterEach() block will not execute, so always clean the slate here
    getJsonFromApiStub = sandbox.stub(apiAdapter, getJsonFromApiMethodName);
    getJsonFromApiStub.onFirstCall().resolves(dataRepositoryServiceObject);
    getJsonFromApiStub.onSecondCall().resolves(googleSAKeyObject);
});

test.serial.afterEach(() => {
    sandbox.restore();
});

test.serial('martha_v3 resolves a valid url', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(Object.assign({}, result), fullExpectedResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 resolves successfully and ignores extra data submitted besides a \'url\'', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            pattern: 'gs://',
            foo: 'bar'
        }
    }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(Object.assign({}, result), fullExpectedResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 should return 400 if a Data Object without authorization header is provided', async (t) => {
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
    t.is(result.response.text, '"Not%20a%20valid%20URI" is not a properly-formatted URI.');
});

test.serial('martha_v3 should return 500 if Data Object resolution fails', async (t) => {
    getJsonFromApiStub.restore();
    sandbox.stub(apiAdapter, getJsonFromApiMethodName).rejects(new Error('Data Object Resolution forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 500);
    t.is(result.status, 500);
    t.is(result.response.text, 'Received error while resolving drs url. Data Object Resolution forced to fail by testing stub');
});

test.serial('martha_v3 should return 500 if key retrieval from bond fails', async (t) => {
    getJsonFromApiStub.restore();
    sandbox.stub(apiAdapter, getJsonFromApiMethodName).rejects(new Error('Bond key lookup forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 500);
    t.is(result.status, 500);
    t.is(result.response.text, 'Received error while resolving drs url. Bond key lookup forced to fail by testing stub');
});

test.serial('martha_v3 calls bond Bond with the "dcf-fence" provider when the Data Object URL host is not "dg.4503"', async (t) => {
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
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://someservice.humancellatlas.org/this_part_can_be_anything' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), fullExpectedResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 does not call Bond or return SA key when the host url is for jade data repo', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), fullExpectedResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 returns null for fields missing in drs and bond response', async (t) => {
    // update the stub to return DRS response with missing fields only for this test
    sandbox.restore();
    getJsonFromApiStub = sandbox.stub(apiAdapter, getJsonFromApiMethodName);
    getJsonFromApiStub.onFirstCall().resolves(drsObjectWithMissingFields);
    getJsonFromApiStub.onSecondCall().resolves(null);

    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(Object.assign({}, result), expectedObjWithMissingFields);
    t.is(response.statusCode, 200);
});
