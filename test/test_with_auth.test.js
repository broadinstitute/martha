
const baseUrl = 'http://localhost:8010/gpolumbo-practice-project/us-central1';

const test = require('ava');
const supertest = require('supertest')(baseUrl);
const execSync = require('child_process').execSync;

const currentUser = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"');
console.log(`Using access token for user: ${currentUser}`);
const bearerToken = execSync('gcloud auth print-access-token').toString().trim();

test.cb('martha_v2 responds with DOS object only when no "authorization" header is provided', (t) => {
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .send({ url: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
        .expect(200)
        .expect((response) => t.truthy(response.body.dos))
        .end(t.end);
});

// TODO: Waiting on redirect URLs to get set up with DCF fence so that we can test non-"dg.4503" DOS URIs
// test.cb('martha_v2 responds with DOS object when "authorization" header is provided', (t) => {
//     supertest
//         .post('/martha_v2')
//         .set('Content-Type', 'application/json')
//         .set('Authorization', `bearer ${bearerToken}`)
//         .send({ url: 'dos://broad-dsp-dos.storage.googleapis.com/dos.json' })
//         .expect(200)
//         .expect((response) => t.truthy(response.body.dos))
//         .end((err, response) => {
//             if (err) console.error(response.text);
//             t.end;
//         });
// });

test.cb('martha_v2 responds with DOS object when "authorization" header is provided', (t) => {
    const objectId = `dg.4503/00082e1c-42f6-4850-b512-413752286593`;
    supertest
        .post('/martha_v2')
        .set('Content-Type', 'application/json')
        .set('Authorization', `bearer ${bearerToken}`)
        .send({ url: `dos://${objectId}` })
        .expect(200)
        .expect((response) => t.truthy(response.body.dos))
        .expect((response) => {
            const dosObject = response.body.dos;
            t.truthy(dosObject.data_object);
            t.is(dosObject.data_object.id, objectId)
        })
        .expect((response) => t.truthy(response.body.googleServiceAccount))
        .expect((response) => {
            const saObject = response.body.googleServiceAccount.data;
            t.truthy(saObject.client_email);
            t.truthy(saObject.client_id);
            t.truthy(saObject.private_key);
        })
        .end((err, response) => {
            if (err) console.error(response.text);
            t.end();
        });
});

// TODO: Test martha_v1 and fileSummaryV1
// test