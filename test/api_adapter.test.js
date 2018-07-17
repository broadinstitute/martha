const test = require(`ava`);
const sinon = require(`sinon`);
const api_adapter = require('../api_adapter');
const superagent = require('superagent');

function mockResponseToGet(text_value) {
    return {
        then: (cb) => {
            return cb({text : text_value});
        },
        set: sinon.stub()
    }
}

let getRequest;

test.before(t => {
    getRequest = sinon.stub(superagent, 'get');
});

test.after(t => {
    getRequest.restore();
});

test('api_adapter.getTextFrom should get the value of the text field from the response', async t => {
    let some_text = "Some special text";
    getRequest.returns(mockResponseToGet(some_text));
    const result = await api_adapter.getTextFrom("Irrelevant URL");
    t.is(result, some_text);
});

test('api_adapter.getTextFrom should append an authorization header when passed an authorization string', async t => {
    let some_text = "Some special text";
    let authz_str = "abc123";
    let mockGet = mockResponseToGet(some_text);
    getRequest.returns(mockGet);
    const result = await api_adapter.getTextFrom("Irrelevant URL", authz_str);
    t.is(result, some_text);
    t.deepEqual(mockGet.set.firstCall.args, ["authorization", authz_str]);
});

test('api_adapter.getTextFrom should NOT append an authorization header when not passed an authorization string', async t => {
    let some_text = "Some special text";
    let mockGet = mockResponseToGet(some_text);
    getRequest.returns(mockGet);
    const result = await api_adapter.getTextFrom("Irrelevant URL");
    t.is(result, some_text);
    t.false(mockGet.set.called);
});