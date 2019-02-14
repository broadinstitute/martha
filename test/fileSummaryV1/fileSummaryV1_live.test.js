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
 *      npm run live_test_fileSummaryV1 -- -- --env=[env] --mock --base_url=[https://...]
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

function assertObjectMetadata(response, t) {
    t.truthy(response.body);
    const metadata = response.body;
    t.truthy(metadata);
    t.truthy(metadata.contentType);
    t.truthy(metadata.size);
    t.truthy(metadata.bucket);
    t.truthy(metadata.name);
    t.truthy(metadata.gsUri);
    t.truthy(metadata.signedUrl);
}

function handleResponse(err, response, t) {
    if (err) {
        let msg = err.message;
        if (response && response.text) {
            msg = msg + '\n' + response.text;
        }
        t.fail(msg);
    } else {
        assertObjectMetadata(response, t);
    }
    t.end();
}

test.before(() => {
    currentUser = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"');
    bearerToken = execSync('gcloud auth print-access-token').toString().trim();
    console.log(`Using access token for user: ${currentUser}`);
    console.log(`Testing Martha functions at: ${marthaLiveEnv.baseUrl}`);
});

test.cb('live_test fileSummaryV1 responds with 401 when no "authorization" header is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ uri: marthaLiveEnv.dosUrls[0] })
        .expect(401)
        .end(t.end);
});

// The resolved DOS objects in this list contain a 'gs://' url in the list of urls
for (const dosUrl of marthaLiveEnv.dosUrlsWithGS) {
    test.cb(`live_test Calling fileSummaryV1 with URL: "${dosUrl}" with an Access Token returns metadata and signed url`, (t) => {
        supertest
            .post('/fileSummaryV1')
            .set('Content-Type', 'application/json')
            .set('Authorization', `bearer ${bearerToken}`)
            .send({uri: dosUrl})
            .expect(200)
            .end((err, response) => handleResponse(err, response, t));
    });
}

// The resolved DOS objects in this list do not contain a 'gs://' url in the list of urls
// TODO: This error scenario is not good.  When there is no gs:// url, the response should be 400 and have a helpful message, not an empty 502
for (const dosUrl of marthaLiveEnv.dosUrlsWithoutGS) {
    test.cb(`live_test Calling fileSummaryV1 with URL: "${dosUrl}" with an Access Token returns an error because the dos object does not contain a 'gs://' url`, (t) => {
        supertest
            .post('/fileSummaryV1')
            .set('Content-Type', 'application/json')
            .set('Authorization', `bearer ${bearerToken}`)
            .send({uri: dosUrl})
            .expect(502)
            .end(t.end);
    });
}
