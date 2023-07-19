/** Run integration tests from the command line.  For example:
 *
 *    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script integration_fileSummaryV1
 *
 * Run integration tests after a deployment to confirm that the functions deployed successfully
 */

const test = require('ava');
const config = require('../../common/config');
const supertest = require('supertest')(config.itMarthaBaseUrl);
const { GoogleToken } = require('gtoken');
const { postJsonTo } = require('../../common/api_adapter');

let unauthorizedToken;
let authorizedToken;

const myEnv = config.dsdeEnv;
const myBondBaseUrl = config.itBondBaseUrl;
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

test('integration_fileSummaryV1 responds with 400 if a uri is not provided', async (t) => {
    await supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ notValid: dataObjectUri })
        .expect((response) => {
            t.is(response.statusCode, 400, 'Incorrect status code');
            t.assert(response.text.includes('must specify the URI'), 'Received the wrong error message');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_fileSummaryV1 responds with 400 if uri passed is malformed', async (t) => {
    await supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ uri: 'somethingNotValidURL' })
        .expect((response) => {
            t.is(response.statusCode, 400, 'Incorrect status code');
            t.assert(response.text.includes('must specify the URI'), 'Received the wrong error message');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_fileSummaryV1 responds with 401 if uri is valid but no authorization is provided', async (t) => {
    await supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ uri: dataObjectUri })
        .expect((response) => {
            t.is(response.statusCode, 401, 'Incorrect status code');
            t.assert(response.text.includes('must contain a bearer token'), 'Received the wrong error message');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_fileSummaryV1 responds with 200 and file metadata but no signed url if Data Object uri is valid but the authorization header does not contain an authorized token', async (t) => {
    await supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ uri: dataObjectUri })
        .expect((response) => {
            t.is(response.statusCode, 200, 'Incorrect status code');
            t.assert(response.body.bucket, 'fileSummary did not return metadata');
            t.assert(!response.body.signedUrl, 'fileSummary returned a signed url but it should not have');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_fileSummaryV1 responds with 200, file metadata, and a signed url if Data Object uri is valid and valid authorization is provided', async (t) => {
    await supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ uri: dataObjectUri })
        .expect((response) => {
            t.is(response.statusCode, 200, 'Incorrect status code');
            t.assert(response.body.bucket, 'fileSummary did not return metadata');
            t.assert(response.body.signedUrl, 'fileSummary did not return a signed url');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_fileSummaryV1 responds with 502 and unauthorized response if gs uri is valid, but an invalid bearer token is provided', async (t) => {
    await supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer badToken')
        .send({ uri: gsUri })
        .expect((response) => {
            t.is(response.statusCode, 502, 'Incorrect status code');
            t.is(response.body.status, 401, 'Response should have been unauthorized');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_fileSummaryV1 responds with 200, file metadata, and a signed url if gs uri is valid and valid authorization is provided', async (t) => {
    await supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ uri: gsUri })
        .expect((response) => {
            t.is(response.statusCode, 200, 'Incorrect status code');
            t.assert(response.body.bucket, 'fileSummary did not return metadata');
            t.assert(response.body.signedUrl, 'fileSummary did not return a signed url');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});
