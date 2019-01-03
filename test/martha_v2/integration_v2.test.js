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

let publicFenceUrl = 'dos://dg.4503/preview_dos.json';
let protectedFenceUrl = 'dos://dg.4503/65e4cd14-f549-4a7f-ad0c-d29212ff6e46';
let publicDcfFenceUrl = 'dos://wb-mock-drs-dev.storage.googleapis.com/preview_dos.json';
let protectedDcfFenceUrl = 'dos://wb-mock-drs-dev.storage.googleapis.com/65e4cd14-f549-4a7f-ad0c-d29212ff6e46';
let fenceAuthLink = 'https://bond-fiab.dsde-dev.broadinstitute.org:31443/api/link/v1/fence/oauthcode?oauthcode=IgnoredByMockProvider&redirect_uri=http%3A%2F%2Flocal.broadinstitute.org%2F%23fence-callback'


test.before(async () => {
    unauthorizedToken = await new GoogleToken({
        keyFile: 'target/firecloud-account.json',
        sub: 'ron.weasley@test.firecloud.org',
        scope: 'profile email openid https://www.googleapis.com/auth/devstorage.full_control https://www.googleapis.com/auth/cloud-platform'
    }).getToken();
    authorizedToken = await new GoogleToken({
        keyFile: 'target/firecloud-account.json',
        sub: 'hermione.owner@test.firecloud.org',
        scope: 'profile email openid https://www.googleapis.com/auth/devstorage.full_control https://www.googleapis.com/auth/cloud-platform'
    }).getToken();

    await postJsonTo(fenceAuthLink, "Bearer " + authorizedToken);
});

test.cb('integration_v2 responds with DOS object only when no "authorization" header is provided for a public url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: publicFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, "Incorrect status code"); // not using loose equality for now, but if type coercion is wanted use equal instead of strictEqual
            assert(response.body.dos, "No DOS object found");
            assert(!response.body.googleServiceAccount, "Response should not have a Google Service Account");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_v2 responds with DOS object and service account when "authorization" header is provided for a public url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ url: publicFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, "Incorrect status code");
            assert(response.body.dos, "No DOS object found");
            assert(response.body.googleServiceAccount, "No Google Service Account found");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_v2 fails when "authorization" header is provided for a public url but user is not authed with provider', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ url: publicDcfFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, "Incorrect status code");
            assert.strictEqual(response.body.status, 400, "User should not be authorized with provider");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
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
            assert.strictEqual(response.statusCode, 502, "Incorrect status code");
            assert.strictEqual(response.body.status, 401, "Bond should not have authenticated this token");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_v2 responds with DOS object only when no "authorization" header is provided for a protected url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, "Incorrect status code");
            assert(response.body.dos, "No DOS object found");
            assert(!response.body.googleServiceAccount, "Response should not have a Google Service Account");
        })
        .end((error, response) => {
            if (error) t.log(response.body);
            t.end(error);
        });
});

test.cb('integration_v2 responds with DOS object and service account when "authorization" header is provided for a protected url', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, "Incorrect status code");
            assert(response.body.dos, "No DOS object found");
            assert(response.body.googleServiceAccount, "No Google Service Account found");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_v2 fails when "authorization" header is provided for a protected url but user is not authed with provider', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ url: protectedDcfFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, "Incorrect status code");
            assert.strictEqual(response.body.status, 400, "User should not be authorized with provider");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_v2 fails when "authorization" header is provided for a protected url but the bearer token is invalid', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer badToken`)
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, "Incorrect status code");
            assert.strictEqual(response.body.status, 401, "Bond should not have authenticated this token");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_v2 return error if url passed is malformed', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'somethingNotValidURL' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 400, "Incorrect status code");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_v2 return error if url passed is not good', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'dos://broad-dsp-dos-TYPO.storage.googleapis.com/something-that-does-not-exist' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, "Incorrect status code");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});
