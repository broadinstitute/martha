const test = require('ava');
const sinon = require('sinon');
const { getJsonFrom } = require('../api_adapter');
const superagent = require('superagent');

function mockResponseToGet(textValue) {
    return {
        then: (cb) => {
            return cb({ body: textValue });
        },
        set: sinon.stub()
    };
}

let getRequest;

test.before(() => {
    getRequest = sinon.stub(superagent, 'get');
});

test.after(() => {
    getRequest.restore();
});

test('api_adapter.getTextFrom should get the value of the text field from the response', async (t) => {
    let someText = { body: 'Some special text' };
    getRequest.returns(mockResponseToGet(someText));
    const result = await getJsonFrom('Irrelevant URL');
    t.is(result, someText);
});

test('api_adapter.getTextFrom should append an authorization header when passed an authorization string', async (t) => {
    let someText = { body: 'Some special text' };
    let authzStr = 'abc123';
    let mockGet = mockResponseToGet(someText);
    getRequest.returns(mockGet);
    const result = await getJsonFrom('Irrelevant URL', authzStr);
    t.is(result, someText);
    t.deepEqual(mockGet.set.firstCall.args, ['authorization', authzStr]);
});

test('api_adapter.getTextFrom should NOT append an authorization header when not passed an authorization string', async (t) => {
    let someText = { body: 'Some special text' };
    let mockGet = mockResponseToGet(someText);
    getRequest.returns(mockGet);
    const result = await getJsonFrom('Irrelevant URL');
    t.is(result, someText);
    t.false(mockGet.set.called);
});
