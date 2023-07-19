/** Run smoketests from the command line.  For example:
 *
 *    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script smoketest_v3
 *
 * Run smoketests after a deployment to confirm that the functions deployed successfully
 */

const test = require('ava');
const config = require('../../common/config');
const supertest = require('supertest')(config.itMarthaBaseUrl);

const publicFenceUrl = 'dos://dg.4503/preview_dos.json';
// Dev Jade Data Repo url. Snapshot id is 93dc1e76-8f1c-4949-8f9b-07a087f3ce7b
const jdrDevTestUrl = 'drs://jade.datarepo-dev.broadinstitute.org/v1_93dc1e76-8f1c-4949-8f9b-07a087f3ce7b_8b07563a-542f-4b5c-9e00-e8fe6b1861de';

/*
 * NOTE: We are only testing few variations of martha_v3 requests. Because these smoke tests are executed by a Google
 * Service Account, we are unable to test martha_v3 without first authenticating that service account with Fence.
 */

test('smoketest_v3 returns error if url passed is malformed', async (t) => {
    await supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .send({ url: 'notAValidURL' })
        .expect((response) => {
            t.assert(response.statusCode.toString().match(/4\d\d/), 'Request did not specify the URL of a DRS object');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('smoketest_v3 return error if url passed is not valid', async (t) => {
    await supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .send({ url: 'dos://broad-dsp-dos-TYPO.storage.googleapis.com/something-that-does-not-exist' })
        .expect((response) => {
            t.assert(response.statusCode.toString().match(/4\d\d/), 'Incorrect status code');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test('smoketest_v3 fails when no "authorization" header is provided for public url', async (t) => {
    await supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .send({ url: publicFenceUrl })
        .expect((response) => {
            t.assert(response.statusCode.toString().match(/4\d\d/), 'Request did not not specify an authorization header');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

test.serial('smoketest_v3 fails when "authorization" header is provided for a public url but the bearer token is invalid', async (t) => {
    await supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer badToken')
        .send({ url: publicFenceUrl })
        .expect((response) => {
            t.assert(response.statusCode.toString().match(/4\d\d/), 'Bond should not have authenticated this token');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});

// Even though this test takes few minutes to complete, this test is the only one that talks to Jade Data Repo dev
test.serial('smoketest_v3 fails when unauthorized user is resolving jade data repo url', async (t) => {
    t.timeout(60*1000);
    await supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer y29.abc.123-456`)
        .send({ url: jdrDevTestUrl })
        .expect((response) => {
            t.is(response.statusCode, 401, 'This user should be unauthorized in Jade Data Repo');
        })
        .catch((error) => {
            t.log(error.response.body);
            t.falsy(error);
        });
});
