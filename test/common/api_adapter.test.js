const test = require('ava');
const sinon = require('sinon');
const {
    GCS_REQUESTER_PAYS_MESSAGE,
    BAD_REQUEST_CODE,
    FORBIDDEN_CODE,
    TOO_MANY_REQUESTS_CODE,
    SERVER_ERROR_CODE,
    NETWORK_AUTH_REQ_CODE,
    EmptyBodyError,
    get,
    getHeaders,
    isGcsRequesterPaysUrl,
    getJsonFrom,
    postJsonTo,
} = require('../../common/api_adapter');
const superagent = require('superagent');

function mockResponse({ body, headers }) {
    return {
        then: (cb) => {
            return cb({ body, headers });
        },
        set: sinon.stub(),
    };
}

class MockError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

const mockGoogleBillingProject = 'some-billing-project';
const mockGcsV2Url = 'https://storage.googleapis.com/some-bucket?sig=ABC';
const mockGcsV2UrlBilled = `${mockGcsV2Url}&userProject=${mockGoogleBillingProject}`;
const mockGenericUrl = 'https://example.com/some/path?sig=ABC';

let getRequest;
let postRequest;
let headRequest;

test.serial.beforeEach(() => {
    sinon.restore();
    getRequest = sinon.stub(superagent, 'get');
    postRequest = sinon.stub(superagent, 'post');
    headRequest = sinon.stub(superagent, 'head');
});

test.serial.afterEach(() => {
    sinon.restore();
});

test.serial('api_adapter get should get the value of the text field from the response', async (t) => {
    const body = 'Some special text';
    const response = mockResponse({ body });
    getRequest.returns(response);
    const result = (await get('get', 'Irrelevant URL')).body;
    sinon.assert.callCount(getRequest, 1);
    t.deepEqual(getRequest.getCall(0).args, ['Irrelevant URL']);
    sinon.assert.callCount(response.set, 0);
    t.is(result, body);
});

test.serial('api_adapter get should append an authorization header when passed an authorization string', async (t) => {
    const body = 'Some special text';
    const authzStr = 'abc123';
    const response = mockResponse({ body });
    getRequest.returns(response);
    const result = (await get('get', 'Irrelevant URL', authzStr)).body;
    sinon.assert.callCount(getRequest, 1);
    t.deepEqual(getRequest.getCall(0).args, ['Irrelevant URL']);
    sinon.assert.callCount(response.set, 1);
    t.deepEqual(response.set.getCall(0).args, ['authorization', authzStr]);
    t.is(result, body);
});

test.serial('api_adapter get should NOT append an authorization header when not passed an authorization string', async (t) => {
    const body = 'Some special text';
    const response = mockResponse({ body });
    getRequest.returns(response);
    const result = (await get('get', 'Irrelevant URL')).body;
    sinon.assert.callCount(getRequest, 1);
    t.deepEqual(getRequest.getCall(0).args, ['Irrelevant URL']);
    sinon.assert.callCount(response.set, 0);
    t.is(result, body);
});

test.serial('api_adapter getHeaders should return the headers', async (t) => {
    const headers = { hello: 'header value' };
    const response = mockResponse({ headers });
    headRequest.returns(response);
    const result = await getHeaders('Irrelevant URL');
    sinon.assert.callCount(headRequest, 1);
    t.deepEqual(headRequest.getCall(0).args, ['Irrelevant URL']);
    sinon.assert.callCount(response.set, 0);
    t.is(result, headers);
});

test.serial('api_adapter getHeaders should throw errors', async (t) => {
    const error = new MockError('testing errors', 500);
    headRequest.rejects(error);
    const result = await t.throwsAsync(getHeaders('Irrelevant URL'));
    sinon.assert.callCount(headRequest, 1);
    t.deepEqual(headRequest.getCall(0).args, ['Irrelevant URL']);
    t.is(result, error);
});

test.serial('api_adapter isGcsRequesterPaysUrl should return false if requester pays is not required', async (t) => {
    const mockGet = mockResponse({ body: 'Irrelevant body' });
    getRequest.returns(mockGet);
    const result = await isGcsRequesterPaysUrl(mockGcsV2Url);
    sinon.assert.callCount(getRequest, 1);
    t.deepEqual(getRequest.getCall(0).args, [mockGcsV2Url]);
    sinon.assert.callCount(mockGet.set, 1);
    t.deepEqual(mockGet.set.getCall(0).args, ['Range', 'bytes=0-0']);
    t.false(result, `a check of ${mockGcsV2Url} not returning an error should not require requester pays`);
});

test.serial('api_adapter isGcsRequesterPaysUrl should add requester pays if forbidden', async (t) => {
    const mockError = new Error('testing errors');
    mockError.status = FORBIDDEN_CODE;
    mockError.response = { text: GCS_REQUESTER_PAYS_MESSAGE };
    getRequest.throws(mockError);
    const result = await isGcsRequesterPaysUrl(mockGcsV2Url);
    sinon.assert.callCount(getRequest, 1);
    t.deepEqual(getRequest.getCall(0).args, [mockGcsV2Url]);
    t.true(result, `a check of ${mockGcsV2Url} returning forbidden should require requester pays`);
});

test.serial('api_adapter isGcsRequesterPaysUrl should add requester pays on a bad request', async (t) => {
    const mockError = new Error('testing errors');
    mockError.status = BAD_REQUEST_CODE;
    mockError.response = { text: GCS_REQUESTER_PAYS_MESSAGE };
    getRequest.throws(mockError);
    const result = await isGcsRequesterPaysUrl(mockGcsV2Url);
    sinon.assert.callCount(getRequest, 1);
    t.deepEqual(getRequest.getCall(0).args, [mockGcsV2Url]);
    t.true(result, `a check of ${mockGcsV2Url} returning 'bad request' should require requester pays`);
});

test.serial('api_adapter isGcsRequesterPaysUrl should fail for a server error', async (t) => {
    const mockError = new Error('testing errors');
    mockError.status = SERVER_ERROR_CODE;
    mockError.response = { text: GCS_REQUESTER_PAYS_MESSAGE };
    getRequest.throws(mockError);
    const result = await t.throwsAsync(isGcsRequesterPaysUrl(mockGcsV2Url));
    sinon.assert.callCount(getRequest, 1);
    t.deepEqual(getRequest.getCall(0).args, [mockGcsV2Url]);
    t.is(result, mockError);
});

test.serial('api_adapter isGcsRequesterPaysUrl should not add requester pays to a non-GCS URL', async (t) => {
    const result = await isGcsRequesterPaysUrl(mockGenericUrl);
    sinon.assert.callCount(getRequest, 0);
    t.false(result, `a check of ${mockGenericUrl} should not require requester pays`);
});

test.serial('api_adapter isGcsRequesterPaysUrl should not add requester pays to URL with existing billing', async (t) => {
    const result = await isGcsRequesterPaysUrl(mockGcsV2UrlBilled);
    sinon.assert.callCount(getRequest, 0);
    t.false(result, `a check of ${mockGcsV2UrlBilled} should not require requester pays`);
});

test.serial('api_adapter getJsonFrom should return the body', async (t) => {
    const body = { hello: 'from getJsonFrom' };
    const response = mockResponse({ body });
    getRequest.returns(response);
    const result = await getJsonFrom('Irrelevant URL');
    sinon.assert.callCount(getRequest, 1);
    t.deepEqual(getRequest.getCall(0).args, ['Irrelevant URL']);
    sinon.assert.callCount(response.set, 0);
    t.is(result, body);
});

test.serial('api_adapter getJsonFrom should retry empty responses', async (t) => {
    const body = '';
    const response = mockResponse({ body });
    getRequest.returns(response);
    const result = await t.throwsAsync(getJsonFrom('Irrelevant URL', null, 1, 0));
    t.deepEqual(
        result,
        new EmptyBodyError(
            `Something went wrong while trying to resolve url 'Irrelevant URL'. It came back with empty JSON body!`
        ),
    );
    sinon.assert.callCount(getRequest, 5);
    for (let i = 0; i < 5; i += 1) {
        t.deepEqual(getRequest.getCall(i).args, ['Irrelevant URL']);
    }
    sinon.assert.callCount(response.set, 0);
});

test.serial('api_adapter getJsonFrom should not retry bad requests', async (t) => {
    const error = new MockError('testing errors', BAD_REQUEST_CODE);
    getRequest.rejects(error);
    const result = await t.throwsAsync(getJsonFrom('Irrelevant URL'));
    t.is(result, error);
    sinon.assert.callCount(getRequest, 1);
    t.deepEqual(getRequest.getCall(0).args, ['Irrelevant URL']);
});

test.serial('api_adapter getJsonFrom should retry too many requests', async (t) => {
    const error = new MockError('testing errors', TOO_MANY_REQUESTS_CODE);
    getRequest.rejects(error);
    const result = await t.throwsAsync(getJsonFrom('Irrelevant URL', null, 1, 0));
    t.is(result, error);
    sinon.assert.callCount(getRequest, 5);
    for (let i = 0; i < 5; i += 1) {
        t.deepEqual(getRequest.getCall(i).args, ['Irrelevant URL']);
    }
});

test.serial('api_adapter getJsonFrom should retry server errors', async (t) => {
    const error = new MockError('testing errors', SERVER_ERROR_CODE);
    getRequest.rejects(error);
    const result = await t.throwsAsync(getJsonFrom('Irrelevant URL', null, 1, 0));
    t.is(result, error);
    sinon.assert.callCount(getRequest, 5);
    for (let i = 0; i < 5; i += 1) {
        t.deepEqual(getRequest.getCall(i).args, ['Irrelevant URL']);
    }
});

test.serial('api_adapter getJsonFrom should retry network auth errors', async (t) => {
    const error = new MockError('testing errors', NETWORK_AUTH_REQ_CODE);
    getRequest.rejects(error);
    const result = await t.throwsAsync(getJsonFrom('Irrelevant URL', null, 1, 0));
    t.is(result, error);
    sinon.assert.callCount(getRequest, 5);
    for (let i = 0; i < 5; i += 1) {
        t.deepEqual(getRequest.getCall(i).args, ['Irrelevant URL']);
    }
});

test.serial('api_adapter getJsonFrom should wait between retries', async (t) => {
    const error = new MockError('testing errors', TOO_MANY_REQUESTS_CODE);
    getRequest.rejects(error);
    const delayMilliseconds = 10;
    const startTime = new Date();
    const result = await t.throwsAsync(getJsonFrom('Irrelevant URL', null, 1, delayMilliseconds));
    const stopTime = new Date();
    const actualElapsed = stopTime - startTime;
    // There are 5 attempts. The first attempt runs right away, then each delay is 2x the previous.
    const expectedElapsed = ((2 ** 4) - 1) * delayMilliseconds;
    t.assert(actualElapsed >= expectedElapsed, `actualElapsed: ${actualElapsed}, expectedElapsed: ${expectedElapsed}`);
    t.is(result, error);
    sinon.assert.callCount(getRequest, 5);
    for (let i = 0; i < 5; i += 1) {
        t.deepEqual(getRequest.getCall(i).args, ['Irrelevant URL']);
    }
});

test.serial('api_adapter postJsonTo should post the body', async (t) => {
    const body = { hello: 'from postJsonTo' };
    const response = mockResponse({ body });
    postRequest.returns(response);
    const payload = { posting: 'some content' };
    const result = await postJsonTo('Irrelevant URL', null, payload);
    sinon.assert.callCount(postRequest, 1);
    t.deepEqual(postRequest.getCall(0).args, ['Irrelevant URL', payload]);
    sinon.assert.callCount(response.set, 1);
    t.deepEqual(response.set.getCall(0).args, ['Content-Type', 'application/json']);
    t.is(result, body);
});

test.serial('api_adapter postJsonTo should append an authorization header when passed an authorization string', async (t) => {
    const body = { hello: 'from postJsonTo' };
    const authzStr = 'abc123';
    const response = mockResponse({ body });
    postRequest.returns(response);
    const payload = { posting: 'some content' };
    const result = await postJsonTo('Irrelevant URL', authzStr, payload);
    sinon.assert.callCount(postRequest, 1);
    t.deepEqual(postRequest.getCall(0).args, ['Irrelevant URL', payload]);
    sinon.assert.callCount(response.set, 2);
    t.deepEqual(response.set.getCall(0).args, ['Content-Type', 'application/json']);
    t.deepEqual(response.set.getCall(1).args, ['authorization', authzStr]);
    t.is(result, body);
});
