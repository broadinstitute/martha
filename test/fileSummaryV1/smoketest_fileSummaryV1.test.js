/** Run smoketests from the command line.  For example:
 *
 *    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script smoketest_fileSummaryV1
 *
 * Run smoketests after a deployment to confirm that the functions deployed successfully
 */

const test = require('ava');
const config = require('../../common/config');
const supertest = require('supertest')(config.itMarthaBaseUrl);

// NOTE: We can only test failure cases of fileSummaryV1Handler.
// Because these smoketests are executed by a Google Service Account, we are unable to test fileSummaryV1Handler (with Authz)
// without first authenticating that service account with Fence.

test('smoketest_fileSummaryV1 responds with 400 if a uri is not provided', async (t) => {
    await supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ notValid: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
        .expect((response) => t.is(response.statusCode, 400))
        .expect((response) => t.true(response.text.includes('must specify the URI')));
});

test('smoketest_fileSummaryV1 responds with 400 if uri passed is malformed', async (t) => {
    await supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ uri: 'somethingNotValidURL' })
        .expect((response) => t.is(response.statusCode, 400))
        .expect((response) => t.true(response.text.includes('must specify the URI')));
});

test('smoketest_fileSummaryV1 responds with 400 if uri is valid but not authorization is provided', async (t) => {
    await supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ uri: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
        .expect((response) => t.is(response.statusCode, 401))
        .expect((response) => t.true(response.text.includes('must contain a bearer token')));
});
