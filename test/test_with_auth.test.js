
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
        let msg = err.message;
        if (response && response.text) {
            msg = msg + '\n' + response.text
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

test.cb('martha_v2 responds with DOS object only when no "authorization" header is provided', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
        .expect(200)
        .end((err, response) => handleResponse(err, response, t, true));
});

test.failing.cb('martha_v2 responds with DOS object when "authorization" header is provided', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `bearer ${bearerToken}`)
        .send({ url: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
        .expect(200)
        .end((err, response) => handleResponse(err, response, t));
});

const dosUrls = [
    'dos://dg.4503/00082e1c-42f6-4850-b512-413752286593',
    'dos://qa.dcf.planx-pla.net/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc',
    'dos://nci-crdc-staging.datacommons.io/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc',
    'dos://dataguids.org/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc'
];

for (const dosUrl of dosUrls) {
    test.cb(`Calling martha_v2 with URL: "${dosUrl}" without an Access Token resolves to a DOS object`, (t) => {
        supertest
            .post('/martha_v2')
            .set('Content-Type', 'application/json')
            .send({url: dosUrl})
            .expect(200)
            .end((err, response) => handleResponse(err, response, t, true));
    });
}

// TODO: this slice should only be temporary until we can link accounts to the other DCF-Fence server
const currentlyFailingUrls = dosUrls.slice(1, 4);
for (const dosUrl of currentlyFailingUrls) {
    test.failing.cb(`Calling martha_v2 with URL: "${dosUrl}" with an Access Token resolves to a DOS object and Google SA Key`, (t) => {
        supertest
            .post('/martha_v2')
            .set('Content-Type', 'application/json')
            .set('Authorization', `bearer ${bearerToken}`)
            .send({ url: dosUrl })
            .expect(200)
            .end((err, response) => handleResponse(err, response, t));
    });
}

// TODO: Test martha_v1 and fileSummaryV1
// test