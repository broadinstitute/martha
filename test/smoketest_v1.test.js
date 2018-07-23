/** Run smoketests from the command line.  For example:
 *
 *    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script smoketest_v1
 *
 * Run smoketests after a deployment to confirm that the functions deployed successfully
 */

const test = require('ava');
const supertest = require('supertest')(process.env.BASE_URL);

test.cb('smoketest_v1 return gs link', (t) => {
    console.log(`base url: ${process.env.BASE_URL}`);
    supertest
        .post('/martha_v1')
        .set('Content-Type', 'application/json')
        .send({ 'url': 'dos://broad-dsp-dos.storage.googleapis.com/dos.json', 'pattern': 'gs://' })
        .expect((response) => {
            t.is(response.statusCode, 200);
            t.deepEqual(response.text, 'gs://broad-public-datasets/NA12878_downsampled_for_testing/unmapped/H06JUADXX130110.1.ATCACGAT.20k_reads.bam');
        })
        .end(t.end);
});

test.cb('smoketest_v1 return error if url passed is not good', (t) => {
    supertest
        .post('/martha_v1')
        .set('Content-Type', 'application/json')
        .send({ 'url': 'somethingNotValidURL' })
        .expect((response) => {
            t.is(response.statusCode, 500);
        })
        .end(t.end);
});
