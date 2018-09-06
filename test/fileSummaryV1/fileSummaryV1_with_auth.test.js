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
 *      npm run with_auth
 *
 */


const baseUrl = process.env.BASE_URL || 'http://localhost:8010/broad-dsde-dev/us-central1';

const test = require('ava');
const supertest = require('supertest')(baseUrl);
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
    console.log(`Testing Martha functions at: ${baseUrl}`);
});

test.cb('with_auth fileSummaryV1 responds with 401 when no "authorization" header is provided', (t) => {
    supertest
        .post('/fileSummaryV1')
        .set('Content-Type', 'application/json')
        .send({ uri: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
        .expect(401)
        .end(t.end);
});

// The resolved DOS objects in this list contain a 'gs://' url in the list of urls
const dosUrlsWithGS = [
    'dos://dos-dss.ucsc-cgp-dev.org/00e6cfa9-a183-42f6-bb44-b70347106bbe?version=2018-06-13T171629.981618Z%E2%80%8E'
];

for (const dosUrl of dosUrlsWithGS) {
    test.cb(`with_auth Calling fileSummaryV1 with URL: "${dosUrl}" with an Access Token returns metadata and signed url`, (t) => {
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
const dosUrlsWithoutGS = [
    'dos://dg.4503/00082e1c-42f6-4850-b512-413752286593',
    'dos://nci-crdc-staging.datacommons.io/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc',
    'dos://dataguids.org/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc'
];

// TODO: This error scenario is not good.  When there is no gs:// url, the response should be 400 and have a helpful message, not an empty 502
for (const dosUrl of dosUrlsWithoutGS) {
    test.cb(`with_auth Calling fileSummaryV1 with URL: "${dosUrl}" with an Access Token returns an error because the dos object does not contain a 'gs://' url`, (t) => {
        supertest
            .post('/fileSummaryV1')
            .set('Content-Type', 'application/json')
            .set('Authorization', `bearer ${bearerToken}`)
            .send({uri: dosUrl})
            .expect(502)
            .end(t.end);
    });
}
