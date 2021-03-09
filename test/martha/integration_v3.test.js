/** Run integration tests from the command line.  For example:
 *
 *    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script integration_v3
 *
 * Run integration tests after a deployment to confirm that the functions deployed successfully
 * (these tests are currently run in Jenkins job 'martha-fiab-test-runner' inside a FIAB)
 */

const test = require('ava');
const config = require('../../common/config');
const supertest = require('supertest')(config.itMarthaBaseUrl);
const assert = require('assert');
const { GoogleToken } = require('gtoken');
const { postJsonTo } = require('../../common/api_adapter');

let unauthorizedToken;
let authorizedToken;

const myEnv = config.dsdeEnv;
const myBondBaseUrl = config.itBondBaseUrl;
const emailDomain = `${myEnv === 'qa' ? 'quality' : 'test'}.firecloud.org`;

const keyFile = 'automation/firecloud-account.pem';
const serviceAccountEmail = `firecloud-${myEnv}@broad-dsde-${myEnv}.iam.gserviceaccount.com`;
const scopes = 'email openid';
const unauthorizedEmail = `ron.weasley@${emailDomain}`;
const authorizedEmail = `hermione.owner@${emailDomain}`;

const publicFenceUrl = 'dos://dg.4503/preview_dos.json';
const protectedFenceUrl = 'dos://dg.4503/65e4cd14-f549-4a7f-ad0c-d29212ff6e46';
const fenceAuthLink =
    `${myBondBaseUrl}/api/link/v1/fence/oauthcode` +
    '?oauthcode=IgnoredByMockProvider' +
    '&redirect_uri=http%3A%2F%2Flocal.broadinstitute.org%2F%23fence-callback';

// Dev Jade Data Repo url. Snapshot id is 93dc1e76-8f1c-4949-8f9b-07a087f3ce7b
const jdrDevTestUrl = 'drs://jade.datarepo-dev.broadinstitute.org/v1_93dc1e76-8f1c-4949-8f9b-07a087f3ce7b_8b07563a-542f-4b5c-9e00-e8fe6b1861de';


test.before(async () => {
    unauthorizedToken = (await new GoogleToken({
        keyFile,
        email: serviceAccountEmail,
        sub: unauthorizedEmail,
        scope: scopes
    }).getToken()).access_token;
    authorizedToken = (await new GoogleToken({
        keyFile,
        email: serviceAccountEmail,
        sub: authorizedEmail,
        scope: scopes
    }).getToken()).access_token;

    await postJsonTo(fenceAuthLink, `Bearer ${authorizedToken}`);
});

// Invalid inputs

test.cb('integration_v3 returns error if url passed is malformed', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .send({ url: 'notAValidURL' })
        .expect((response) => {
            assert.ok(response.statusCode.toString().match(/4\d\d/), 'Request did not specify the URL of a DRS object');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v3 return error if url passed is not good', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ url: 'dos://broad-dsp-dos-TYPO.storage.googleapis.com/something-that-does-not-exist' })
        .expect((response) => {
            assert.ok(response.statusCode.toString().match(/4\d\d/), 'Incorrect status code');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

// Public data guid url

test.cb('integration_v3 fails when no "authorization" header is provided for public url', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .send({ url: publicFenceUrl })
        .expect((response) => {
            assert.ok(response.statusCode.toString().match(/4\d\d/), 'Request did not not specify an authorization header');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v3 succeeds for a public url', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ url: publicFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code');
            assert(response.body.gsUri, 'No gsUri found');
            assert(response.body.googleServiceAccount, 'No Google Service Account found');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v3 fails when "authorization" header is provided for a public url but user is not authed with provider', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ url: publicFenceUrl })
        .expect((response) => {
            assert.ok(response.statusCode.toString().match(/4\d\d/), 'User should not be authorized with provider');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v3 fails when "authorization" header is provided for a public url but the bearer token is invalid', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer badToken')
        .send({ url: publicFenceUrl })
        .expect((response) => {
            assert.ok(response.statusCode.toString().match(/4\d\d/), 'Bond should not have authenticated this token');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

// Protected data guid url

test.cb('integration_v3 fails when no "authorization" header is provided for a protected url', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.ok(response.statusCode.toString().match(/4\d\d/), 'Request did not not specify an authorization header');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v3 succeeds for a protected url', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code');
            assert(response.body.gsUri, 'No gsUri found');
            assert(response.body.googleServiceAccount, 'No Google Service Account found');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v3 fails when "authorization" header is provided for a protected url but user is not authed with provider', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.ok(response.statusCode.toString().match(/4\d\d/), 'User should not be authorized with provider');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v3 fails when "authorization" header is provided for a protected url but the bearer token is invalid', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer badToken')
        .send({ url: protectedFenceUrl })
        .expect((response) => {
            assert.ok(response.statusCode.toString().match(/4\d\d/), 'Bond should not have authenticated this token');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

// Jade Data Repo url

test.cb('integration_v3 responds with Data Object for authorized user for jade data repo url', (t) => {
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${authorizedToken}`)
        .send({ url: jdrDevTestUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 200, 'Incorrect status code');
            assert.deepStrictEqual(
                response.body,
                {
                    contentType: 'application/octet-stream',
                    size: 15601108255,
                    timeCreated: '2020-04-27T15:56:09.696Z',
                    timeUpdated: '2020-04-27T15:56:09.696Z',
                    bucket: 'broad-jade-dev-data-bucket',
                    name: 'fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/8b07563a-542f-4b5c-9e00-e8fe6b1861de',
                    gsUri:
                        'gs://broad-jade-dev-data-bucket/fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/' +
                        '8b07563a-542f-4b5c-9e00-e8fe6b1861de',
                    googleServiceAccount: null,
                    fileName: 'HG00096.mapped.ILLUMINA.bwa.GBR.low_coverage.20120522.bam',
                    hashes: {
                        md5: '336ea55913bc261b72875bd259753046',
                        crc32c: 'ecb19226'
                    }
                }
            );
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});

test.cb('integration_v3 fails when unauthorized user is resolving jade data repo url', (t) => {
    // JDR was returning slowly for this integration test. Give it a bit more time.
    // And someday, when we have performance tests outside of prod, remove the line below! ;)
    t.timeout(60*1000);
    supertest
        .post('/martha_v3')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ url: jdrDevTestUrl })
        .expect((response) => {
            assert.strictEqual(response.statusCode, 401, 'This user should be unauthorized in Jade Data Repo');
        })
        .end((error, response) => {
            if (error) { t.log(response.body); }
            t.end(error);
        });
});
