/** Run integration tests from the command line.  For example:
 *
 *    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script integration_v2
 *
 * Run integration tests after a deployment to confirm that the functions deployed successfully
 */

const test = require('ava');
const supertest = require('supertest')(process.env.BASE_URL);
const assert = require('assert');
const { GoogleToken } = require('gtoken');
const { postJsonTo } = require('../../common/api_adapter');

let unauthorizedToken;
let authorizedToken;

const myEnv = process.env.ENV ? process.env.ENV : 'dev';
const emailDomain = (myEnv === 'qa' ? 'quality' : 'test') + '.firecloud.org';

let keyFile = 'automation/firecloud-account.pem';
const serviceAccountEmail = `firecloud-${myEnv}@broad-dsde-${myEnv}.iam.gserviceaccount.com`;
let scopes = 'email openid';
const unauthorizedEmail = `ron.weasley@${emailDomain}`;
const authorizedEmail = `hermione.owner@${emailDomain}`;

let publicFenceUrl = 'dos://dg.4503/preview_dos.json';
let protectedFenceUrl = 'dos://dg.4503/65e4cd14-f549-4a7f-ad0c-d29212ff6e46';
// TODO: remove static link so bond host can be changed depending on env
const fenceAuthLink = `https://bond-fiab.dsde-${myEnv}.broadinstitute.org:31443/api/link/v1/fence/oauthcode?oauthcode=IgnoredByMockProvider&redirect_uri=http%3A%2F%2Flocal.broadinstitute.org%2F%23fence-callback`;

test.before(async () => {
    unauthorizedToken = await new GoogleToken({
        keyFile: keyFile,
        email: serviceAccountEmail,
        sub: unauthorizedEmail,
        scope: scopes
    }).getToken();
    authorizedToken = await new GoogleToken({
        keyFile: keyFile,
        email: serviceAccountEmail,
        sub: authorizedEmail,
        scope: scopes
    }).getToken();

    await postJsonTo(fenceAuthLink, 'Bearer ' + authorizedToken);
});

test.cb('integration_v2 responds with DRS object only when no "authorization" header is provided for a public url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: publicFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code'); // not using loose equality for now, but if type coercion is wanted use equal instead of strictEqual
            assert(response.body.drs, 'No DRS object found');
            assert(!response.body.googleServiceAccount, 'Response should not have a Google Service Account');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v2 responds with DRS object and service account when "authorization" header is provided for a public url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ url: publicFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code');
            assert(response.body.drs, 'No DRS object found');
            assert(response.body.googleServiceAccount, 'No Google Service Account found');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v2 fails when "authorization" header is provided for a public url but user is not authed with provider', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ url: publicFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, 'Incorrect status code');
            assert.strictEqual(response.body.status, 400, 'User should not be authorized with provider');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v2 fails when "authorization" header is provided for a public url but the bearer token is invalid', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer badToken`)
        .send({ url: publicFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, 'Incorrect status code');
            assert.strictEqual(response.body.status, 401, 'Bond should not have authenticated this token');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v2 responds with DRS object only when no "authorization" header is provided for a protected url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code');
            assert(response.body.drs, 'No DRS object found');
            assert(!response.body.googleServiceAccount, 'Response should not have a Google Service Account');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v2 responds with DRS object and service account when "authorization" header is provided for a protected url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code');
            assert(response.body.drs, 'No DRS object found');
            assert(response.body.googleServiceAccount, 'No Google Service Account found');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v2 fails when "authorization" header is provided for a protected url but user is not authed with provider', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, 'Incorrect status code');
            assert.strictEqual(response.body.status, 400, 'User should not be authorized with provider');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v2 fails when "authorization" header is provided for a protected url but the bearer token is invalid', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer badToken')
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, 'Incorrect status code');
            assert.strictEqual(response.body.status, 401, 'Bond should not have authenticated this token');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v2 return error if url passed is malformed', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'somethingNotValidURL' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 400, 'Incorrect status code');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v2 return error if url passed is not good', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'dos://broad-dsp-dos-TYPO.storage.googleapis.com/something-that-does-not-exist' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, 'Incorrect status code');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});
