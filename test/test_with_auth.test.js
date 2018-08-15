
const baseUrl = 'http://localhost:8010/gpolumbo-practice-project/us-central1';

const test = require('ava');
const supertest = require('supertest')(baseUrl);
const execSync = require('child_process').execSync;

const currentUser = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"');
console.log(`Using access token for user: ${currentUser}`);
const bearerToken = execSync('gcloud auth print-access-token').toString().trim();

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
        if (response && response.text) {
            console.error(response.text);
        }
        t.fail(err);
    } else {
        assertDosObject(response, t);
        if (!skipGoogleServiceAccount) {
            assertGoogleServiceAccount(response, t);
        }
    }
    t.end();
}

test.cb('martha_v2 responds with DOS object only when no "authorization" header is provided', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
        .expect(200)
        .end((err, response) => handleResponse(err, response, t, true));
});

test.cb('martha_v2 responds with DOS object when "authorization" header is provided', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `bearer ${bearerToken}`)
        .send({ url: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
        .expect(200)
        .end((err, response) => handleResponse(err, response, t));
});

test.cb('martha_v2 responds with DOS object when "authorization" header is provided', (t) => {
    const objectId = `dg.4503/00082e1c-42f6-4850-b512-413752286593`;
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `bearer ${bearerToken}`)
        .send({ url: `dos://${objectId}` })
        .expect(200)
        .end((err, response) => handleResponse(err, response, t));
});

// https://qa.dcf.planx-pla.net/ga4gh/dos/v1/dataobjects/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc

// TODO: Test martha_v1 and fileSummaryV1
// test