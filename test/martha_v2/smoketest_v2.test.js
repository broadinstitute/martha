/** Run smoketests from the command line.  For example:
 *
 *    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script smoketest_v2
 *
 * Run smoketests after a deployment to confirm that the functions deployed successfully
 */

const test = require('ava');
const supertest = require('supertest')(process.env.BASE_URL);

// NOTE: We are only testing one variation of the successful martha_v2 test.
// Because these smoketests are executed by a Google Service Account, we are unable to test martha_v2 (with Authz)
// without first authenticating that service account with Fence.

test.cb('smoketest_v2 responds with DOS object only when no "authorization" header is provided', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
        .expect(200)
        .expect((response) => t.truthy(response.body.dos))
        .end(t.end);
});

test.cb('smoketest_v2 return error if url passed is malformed', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'somethingNotValidURL' })
        .expect(400)
        .end(t.end);
});

test.cb('smoketest_v2 return error if url passed is not good', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'dos://broad-dsp-dos-TYPO.storage.googleapis.com/something-that-does-not-exist' })
        .expect(502)
        .end(t.end);
});
