const test = require("ava");
const sinon = require("sinon");
const apiAdapter = require("../api_adapter");
const superagent = require("superagent");

function mockResponseToGet(textValue) {
    return {
        then: (cb) => {
            return cb({text : textValue});
        },
        set: sinon.stub()
    }
}

let getRequest;

test.before((t) => {
    getRequest = sinon.stub(superagent, "get");
});

test.after((t) => {
    getRequest.restore();
});

test("api_adapter.getTextFrom should get the value of the text field from the response", async (t) => {
    let someText = "Some special text";
    getRequest.returns(mockResponseToGet(someText));
    const result = await apiAdapter.getTextFrom("Irrelevant URL");
    t.is(result, someText);
});

test("api_adapter.getTextFrom should append an authorization header when passed an authorization string", async (t) => {
    let someText = "Some special text";
    let authz_str = "abc123";
    let mockGet = mockResponseToGet(someText);
    getRequest.returns(mockGet);
    const result = await apiAdapter.getTextFrom("Irrelevant URL", authz_str);
    t.is(result, someText);
    t.deepEqual(mockGet.set.firstCall.args, ["authorization", authz_str]);
});

test("api_adapter.getTextFrom should NOT append an authorization header when not passed an authorization string", async (t) => {
    let someText = "Some special text";
    let mockGet = mockResponseToGet(someText);
    getRequest.returns(mockGet);
    const result = await apiAdapter.getTextFrom("Irrelevant URL");
    t.is(result, someText);
    t.false(mockGet.set.called);
});