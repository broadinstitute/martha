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
const getSignedUrlV1 = require('../../handlers/getSignedUrlV1');
const apiAdapter = require('../../common/api_adapter');
const storageFile = require('@google-cloud/storage').File;

const mockRequest = (req) => {
    req.method = 'POST';
    req.headers = {authorization: 'bearer abc123'};
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

const fakeSignedUrl = 'http://i.am.a.signed.url.com/totallyMadeUp';
const fakeSAKey = {key: 'I am not real'};
const bondSAKeyUrlRegEx = /^https:\/\/([^/]+)\/api\/link\/v1\/([a-z-]+)\/serviceaccount\/key$/;
const samPetSAKeyUrlRegEx = /^.*\/user\/petServiceAccount\/key$/;

let getJsonFromApiStub;
let getSignedUrlStub;
const sandbox = sinon.createSandbox();

test.serial.beforeEach(() => {
    sandbox.restore(); // If one test fails, the .afterEach() block will not execute, so always clean the slate here
    getJsonFromApiStub = sandbox.stub(apiAdapter, 'getJsonFrom');
    getSignedUrlStub = sandbox.stub(storageFile.prototype, 'getSignedUrl');
});

test.serial.afterEach(() => {
    sandbox.restore();
});

test.serial('Valid bucket and object(only) returns signed URL using SA key from SAM', async (t) => {
    getJsonFromApiStub.resolves(fakeSAKey);
    getSignedUrlStub.resolves([fakeSignedUrl]);
    const response = mockResponse();
    await getSignedUrlV1(mockRequest({
        body: {
            bucket: 'testBucket',
            object: 'testObjectKey',
        }
    }), response);
    t.regex(getJsonFromApiStub.firstCall.args[0], samPetSAKeyUrlRegEx); // User SA key obtained from SAM
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    t.is(fakeSignedUrl, result.url);
});

test.serial('Valid bucket, object, and Data GUID dataObjectUri returns signed URL using SA key from Bond', async (t) => {
    getJsonFromApiStub.resolves(fakeSAKey);
    getSignedUrlStub.resolves([fakeSignedUrl]);
    const response = mockResponse();
    await getSignedUrlV1(mockRequest({
        body: {
            bucket: 'testBucket',
            object: 'testObjectKey',
            dataObjectUri: 'drs://dg.4503/this_part_can_be_anything'
        }
    }), response);
    t.regex(getJsonFromApiStub.firstCall.args[0], bondSAKeyUrlRegEx); // User SA key obtained from Bond/Fence
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    t.is(fakeSignedUrl, result.url);
});

test.serial('Valid bucket, object, and HCA dataObjectUri returns signed URL using SA key from SAM', async (t) => {
    getJsonFromApiStub.resolves(fakeSAKey);
    getSignedUrlStub.resolves([fakeSignedUrl]);
    const response = mockResponse();
    await getSignedUrlV1(mockRequest({
        body: {
            bucket: 'testBucket',
            object: 'testObjectKey',
            dataObjectUri: 'drs://someservice.humancellatlas.org/this_part_can_be_anything'
        }
    }), response);
    t.regex(getJsonFromApiStub.firstCall.args[0], samPetSAKeyUrlRegEx); // User SA key obtained from SAM
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    t.is(fakeSignedUrl, result.url);
});

test.serial('Valid bucket, object, and JDR dataObjectUri returns signed URL using SA key from SAM', async (t) => {
    getJsonFromApiStub.resolves(fakeSAKey);
    getSignedUrlStub.resolves([fakeSignedUrl]);
    const response = mockResponse();
    await getSignedUrlV1(mockRequest({
        body: {
            bucket: 'testBucket',
            object: 'testObjectKey',
            dataObjectUri: 'drs://jade.datarepo-dev.broadinstitute.org/this_part_can_be_anything'
        }
    }), response);
    t.regex(getJsonFromApiStub.firstCall.args[0], samPetSAKeyUrlRegEx); // User SA key obtained from SAM
    t.is(response.statusCode, 200);
    const result = response.send.lastCall.args[0];
    t.is(fakeSignedUrl, result.url);
});

test.serial(
    'Valid bucket, object, and dataguids.org dataObjectUri returns signed URL using SA key from SAM',
    async (t) => {
        getJsonFromApiStub.resolves(fakeSAKey);
        getSignedUrlStub.resolves([fakeSignedUrl]);
        const response = mockResponse();
        await getSignedUrlV1(mockRequest({
            body: {
                bucket: 'testBucket',
                object: 'testObjectKey',
                dataObjectUri: 'dos://dataguids.org/a41b0c4f-ebfb-4277-a941-507340dea85d'
            }
        }), response);
        t.regex(getJsonFromApiStub.firstCall.args[0], bondSAKeyUrlRegEx); // User SA key obtained from Bond/Fence
        t.is(response.statusCode, 200);
        const result = response.send.lastCall.args[0];
        t.is(fakeSignedUrl, result.url);
    }
);

test.serial(
    'getSignedUrlV1 should return error text',
    async (t) => {
        const error = new Error('this is a test');
        error.stack = null;
        getJsonFromApiStub.rejects(error);
        const response = mockResponse();
        await getSignedUrlV1(mockRequest({
            body: {
                bucket: 'testBucket',
                object: 'testObjectKey',
                dataObjectUri: 'dos://dataguids.org/a41b0c4f-ebfb-4277-a941-507340dea85d'
            }
        }), response);
        t.regex(getJsonFromApiStub.firstCall.args[0], bondSAKeyUrlRegEx); // User SA key obtained from Bond/Fence
        t.is(response.statusCode, 500);
        t.is(response.send.lastCall.args[0], 'Error: this is a test');
    }
);
