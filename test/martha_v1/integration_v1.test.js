/** Run integration tests from the command line.  For example:
 *
 *    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script integration_v1
 *
 * Run integration tests after a deployment to confirm that the functions deployed successfully
 */

const test = require('ava');
const supertest = require('supertest')(process.env.BASE_URL);
const assert = require('assert');

test.cb('integration_v1 return gs link', (t) => {
    supertest
        .post('/martha_v1')
        .set('Content-Type', 'application/json')
        .send({ 'url': 'drs://broad-dsp-drs.storage.googleapis.com/drs.json', 'pattern': 'gs://' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code');
            assert.deepStrictEqual(response.text, 'gs://broad-public-datasets/NA12878_downsampled_for_testing/unmapped/H06JUADXX130110.1.ATCACGAT.20k_reads.bam');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v1 return error if url passed is not good', (t) => {
    supertest
        .post('/martha_v1')
        .set('Content-Type', 'application/json')
        .send({ 'url': 'somethingNotValidURL' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 500, 'Incorrect status code');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v1 return 404 if no match is found', (t) => {
    supertest
        .post('/martha_v1')
        .set('Content-Type', 'application/json')
        .send({ 'url': 'drs://broad-dsp-drs.storage.googleapis.com/drs.json', 'pattern': 'bad:pattern//' })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 404, 'Incorrect status code');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});
