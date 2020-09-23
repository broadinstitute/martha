const test = require('ava');
const config = require('../../common/config');
const supertest = require('supertest')(config.testMarthaBaseUrl);
const assert = require('assert');
const { GoogleToken } = require('gtoken');
const { postJsonTo } = require('../../common/api_adapter');

let unauthorizedToken;
let authorizedToken;

const myEnv = config.terraEnv;
const myBondBaseUrl = config.testBondBaseUrl;
const emailDomain = `${myEnv === 'qa' ? 'quality' : 'test'}.firecloud.org`;

const keyFile = 'automation/firecloud-account.pem';
const serviceAccountEmail = `firecloud-${myEnv}@broad-dsde-${myEnv}.iam.gserviceaccount.com`;
const scopes = 'email openid';
const unauthorizedEmail = `ron.weasley@${emailDomain}`;
const authorizedEmail = `hermione.owner@${emailDomain}`;

const dataObjectUri = 'dos://dg.4503/preview_dos.json';
const gsUri = 'gs://wb-mock-drs-dev/public/dos_test.txt';
const fenceAuthLink =
    `${myBondBaseUrl}/api/link/v1/fence/oauthcode` +
    '?oauthcode=IgnoredByMockProvider' +
    '&redirect_uri=http%3A%2F%2Flocal.broadinstitute.org%2F%23fence-callback';

test.before(async () => {
    unauthorizedToken = (await new GoogleToken({
        keyFile: keyFile,
        email: serviceAccountEmail,
        sub: unauthorizedEmail,
        scope: scopes
    }).getToken()).access_token;
    authorizedToken = (await new GoogleToken({
        keyFile: keyFile,
        email: serviceAccountEmail,
        sub: authorizedEmail,
        scope: scopes
    }).getToken()).access_token;

    await postJsonTo(fenceAuthLink, `Bearer ${authorizedToken}`);
});

test.cb('integration_fileSummaryV1 responds with 400 if a uri is not provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ notValid: dataObjectUri })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 400, 'Incorrect status code');
            assert(response.text.includes('must specify the URI'), 'Received the wrong error message');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 400 if uri passed is malformed', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ uri: 'somethingNotValidURL' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 400, 'Incorrect status code');
            assert(response.text.includes('must specify the URI'), 'Received the wrong error message');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 401 if uri is valid but no authorization is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ uri: dataObjectUri })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 401, 'Incorrect status code');
            assert(response.text.includes('must contain a bearer token'), 'Received the wrong error message');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 200 and file metadata but no signed url if Data Object uri is valid but the authorization header does not contain an authorized token', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ uri: dataObjectUri })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code');
            assert(response.body.bucket, 'fileSummary did not return metadata');
            assert(!response.body.signedUrl, 'fileSummary returned a signed url but it should not have');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 200, file metadata, and a signed url if Data Object uri is valid and valid authorization is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ uri: dataObjectUri })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code');
            assert(response.body.bucket, 'fileSummary did not return metadata');
            assert(response.body.signedUrl, 'fileSummary did not return a signed url');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 502 and unauthorized response if gs uri is valid, but an invalid bearer token is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer badToken')
        .send({ uri: gsUri })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, 'Incorrect status code');
            assert.strictEqual(response.body.status, 401, 'Response should have been unauthorized');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 200, file metadata, and a signed url if gs uri is valid and valid authorization is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ uri: gsUri })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code');
            assert(response.body.bucket, 'fileSummary did not return metadata');
            assert(response.body.signedUrl, 'fileSummary did not return a signed url');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});
