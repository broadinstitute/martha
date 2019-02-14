/**
 *  Run real tests against Martha functions running at `baseUrl`
 *
 *  Pre-requisites:
 *   1. Based on what you have specified as the `baseUrl`, the Martha functions at that location will be configured to
 *      communicate with a specific instance of Bond.  You must ensure that you have linked your User account in that
 *      Bond instance with all supported Providers on that instance.
 *   2. This test will make a system call to `gcloud auth print-access-token`, so on the command line, you will need to
 *      ensure that you are logged in as the correct user that you linked in Bond in step 1.
 *
 *  To run these tests:
 *
 *      npm run live_test_martha_v2 -- -- --env=[env] --mock --base_url=[https://...]
 *
 *      There are 3 optional parameters you can pass:
 *
 *          env         - Can be one of ['dev', 'staging', 'alpha', 'perf', 'prod'].  Used to automatically determine
 *                        the `base_url`.  Defaults to `local`.
 *          mock        - If present or set to `true`, then tests will use DRS URLs that are resolvable by the mock-drs
 *                        service.  If `mock` is absent or set to `false`, tests will use DRS URLs resolvable by the
 *                        live/public DRS resolvers.
 *          base_url    - The base URL (protocol and host) where the Martha functions will be called.  Set this option
 *                        if you want to override the `base_url` derived from the `env` option.  Defaults to
 *                        `http://localhost:8010/broad-dsde-dev/us-central1`.
 */

const { MarthaLiveEnv } = require('../_marthaLiveEnv');
const marthaLiveEnv = new MarthaLiveEnv(process.argv.slice(2));

const test = require('ava');
const supertest = require('supertest')(marthaLiveEnv.baseUrl);
const execSync = require('child_process').execSync;

let currentUser;
let bearerToken;

function assertDosObject(response, t) {
    t.truthy(response.body.dos);
    const dosObject = response.body.dos;
    t.truthy(dosObject.data_object);
}

function assertGoogleServiceAccount(response, t) {
    t.truthy(response.body.googleServiceAccount);
    t.truthy(response.body.googleServiceAccount.data);
    const saObject = response.body.googleServiceAccount.data;
    t.truthy(saObject.client_email);
    t.truthy(saObject.client_id);
    t.truthy(saObject.private_key);
}

function handleResponse(err, response, t, skipGoogleServiceAccount = false) {
    if (err) {
        let msg = err.message;
        if (response && response.text) {
            msg = msg + '\n' + response.text;
        }
        t.fail(msg);
    } else {
        assertDosObject(response, t);
        if (!skipGoogleServiceAccount) {
            assertGoogleServiceAccount(response, t);
        }
    }
    t.end();
}

test.before(() => {
    currentUser = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"');
    bearerToken = execSync('gcloud auth print-access-token').toString().trim();
    console.log(`Using access token for user: ${currentUser}`);
    console.log(`Testing Martha functions at: ${marthaLiveEnv.baseUrl}`);
    console.log(`Martha settings: ${JSON.stringify(marthaLiveEnv)}`);
});

test.cb('live_test martha_v2 responds with DOS object only when no "authorization" header is provided', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: marthaLiveEnv.dosUrls[0] })
        .expect(200)
        .end((err, response) => handleResponse(err, response, t, true));
});

test.cb('live_test martha_v2 responds with DOS object when "authorization" header is provided', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `bearer ${bearerToken}`)
        .send({ url: marthaLiveEnv.dosUrls[0] })
        .expect(200)
        .end((err, response) => handleResponse(err, response, t));
});

for (const dosUrl of marthaLiveEnv.dosUrls) {
    test.cb(`live_test Calling martha_v2 with URL: "${dosUrl}" without an Access Token resolves to a DOS object`, (t) => {
        supertest
            .post('/martha_v2')
            .set('Content-Type', 'application/json')
            .send({url: dosUrl})
            .expect(200)
            .end((err, response) => handleResponse(err, response, t, true));
    });
}
