/** Run integration tests from the command line.  For example:
 *
 *    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script integration_v2
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

const publicFenceUrl = 'dos://dg.4503/preview_dos.json';
const protectedFenceUrl = 'dos://dg.4503/65e4cd14-f549-4a7f-ad0c-d29212ff6e46';
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

test('integration_v2 responds with Data Object only when no "authorization" header is provided for a public url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: publicFenceUrl })
        .expect((response) => {
            t.is(response.statusCode, 200, 'Incorrect status code'); // not using loose equality for now, but if type coercion is wanted use equal instead of strictEqual
            t.assert(response.body.dos, 'No Data Object found');
            t.assert(!response.body.googleServiceAccount, 'Response should not have a Google Service Account');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_v2 responds with Data Object and service account when "authorization" header is provided for a public url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ url: publicFenceUrl })
        .expect((response) => {
            t.is(response.statusCode, 200, 'Incorrect status code');
            t.assert(response.body.dos, 'No Data Object found');
            t.assert(response.body.googleServiceAccount, 'No Google Service Account found');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_v2 fails when "authorization" header is provided for a public url but user is not authed with provider', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ url: publicFenceUrl })
        .expect((response) => {
            t.is(response.statusCode, 502, 'User should not be authorized with provider');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_v2 fails when "authorization" header is provided for a public url but the bearer token is invalid', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer badToken`)
        .send({ url: publicFenceUrl })
        .expect((response) => {
            t.is(response.statusCode, 502, 'Bond should not have authenticated this token');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_v2 responds with Data Object only when no "authorization" header is provided for a protected url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            t.is(response.statusCode, 200, 'Incorrect status code');
            t.assert(response.body.dos, 'No Data Object found');
            t.assert(!response.body.googleServiceAccount, 'Response should not have a Google Service Account');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_v2 responds with Data Object and service account when "authorization" header is provided for a protected url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            t.is(response.statusCode, 200, 'Incorrect status code');
            t.assert(response.body.dos, 'No Data Object found');
            t.assert(response.body.googleServiceAccount, 'No Google Service Account found');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_v2 fails when "authorization" header is provided for a protected url but user is not authed with provider', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            t.is(response.statusCode, 502, 'User should not be authorized with provider');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_v2 fails when "authorization" header is provided for a protected url but the bearer token is invalid', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer badToken')
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            t.is(response.statusCode, 502, 'Bond should not have authenticated this token');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_v2 return error if url passed is malformed', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'somethingNotValidURL' })
        .expect((response) => {
            t.is(response.statusCode, 400, 'Incorrect status code');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('integration_v2 return error if url passed is not good', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'dos://broad-dsp-dos-TYPO.storage.googleapis.com/something-that-does-not-exist' })
        .expect((response) => {
            t.is(response.statusCode, 502, 'Incorrect status code');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});
