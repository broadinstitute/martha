/** Run integration tests from the command line.  For example:
 *
 *    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script integration_fileSummaryV1
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

let fenceAuthLink = 'https://bond-fiab.dsde-dev.broadinstitute.org:31443/api/link/v1/fence/oauthcode?oauthcode=IgnoredByMockProvider&redirect_uri=http%3A%2F%2Flocal.broadinstitute.org%2F%23fence-callback'

test.before(async () => {
    unauthorizedToken = await new GoogleToken({
        keyFile: '/Users/mtalbott/ws/broad/martha/firecloud-account.json', // TODO: change filepath to actual .pem key (need it to be .json?)
        sub: 'ron.weasley@test.firecloud.org',
        scope: 'profile email openid https://www.googleapis.com/auth/devstorage.full_control https://www.googleapis.com/auth/cloud-platform'
    }).getToken();
    authorizedToken = await new GoogleToken({
        keyFile: '/Users/mtalbott/ws/broad/martha/firecloud-account.json',
        sub: 'hermione.owner@test.firecloud.org',
        scope: 'profile email openid https://www.googleapis.com/auth/devstorage.full_control https://www.googleapis.com/auth/cloud-platform'
    }).getToken();

    await postJsonTo(fenceAuthLink, "Bearer " + authorizedToken);
});

test.cb('integration_fileSummaryV1 responds with 400 if a uri is not provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ notValid: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 400, "Incorrect status code")
            assert(response.text.includes('must specify the URI'), "Received the wrong error message")
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 400 if uri passed is malformed', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ uri: 'somethingNotValidURL' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 400, "Incorrect status code")
            assert(response.text.includes('must specify the URI'), "Received the wrong error message")
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 401 if uri is valid but no authorization is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ uri: 'dos://dg.4503/preview_dos.json' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 401, "Incorrect status code")
            assert(response.text.includes('must contain a bearer token'), "Received the wrong error message")
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 200 and file metadata but no signed url if dos uri is valid, but an invalid bearer token is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer badToken`)
        .send({ uri: 'dos://dg.4503/preview_dos.json'})
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, "Incorrect status code");
            assert(response.body.bucket, "fileSummary did not return metadata");
            assert(!response.body.signedUrl, "fileSummary returned a signed url but it should not have");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 200 and file metadata but no signed url if dos uri is valid, a valid bearer token is provided, but account is not linked with provider', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ uri: 'dos://wb-mock-drs-dev.storage.googleapis.com/preview_dos.json'})
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, "Incorrect status code");
            assert(response.body.bucket, "fileSummary did not return metadata");
            assert(!response.body.signedUrl, "fileSummary returned a signed url but it should not have");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 200, file metadata, and a signed url if dos uri is valid and valid authorization is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ uri: 'dos://dg.4503/preview_dos.json'})
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, "Incorrect status code");
            assert(response.body.bucket, "fileSummary did not return metadata");
            assert(response.body.signedUrl, "fileSummary did not return a signed url");
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 502 and unauthorized response if gs uri is valid, but an invalid bearer token is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer badToken`)
        .send({ uri: 'gs://wb-mock-drs-dev/public/dos_test.txt'})
        .expect((response) => {
            assert.strictEqual(response.statusCode, 502, "Incorrect status code");
            assert.strictEqual(response.body.status, 401, "Response should have been unauthorized")
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});

test.cb('integration_fileSummaryV1 responds with 200, file metadata, and a signed url if gs uri is valid and valid authorization is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ uri: 'gs://wb-mock-drs-dev/public/dos_test.txt'})
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, "Incorrect status code");
            assert(response.body.bucket, "fileSummary did not return metadata");
            assert(response.body.signedUrl, "fileSummary did not return a signed url")
        })
        .end((error, response) => {
            if (error) { t.log(response.body) };
            t.end(error);
        });
});
