/** Run smoketests from the command line.  For example:
*
*    BASE_URL="https://us-central1-broad-dsde-dev.cloudfunctions.net" npm run-script smoketest_v2
*
* Run smoketests after a deployment to confirm that the functions deployed successfully
*/

const test = require("ava");
const supertest = require("supertest")(process.env.BASE_URL);
const execSync = require("child_process").execSync;

// console.log(output);

// function execute(command, callback){
//     exec(command, function(error, stdout, stderr){ callback(stdout); });
// }
//
// let output;
// execute("uptime", ()

// test.cb("smoketest_v2 return gs link", (t) => {
//     console.log(`base url: ${process.env.BASE_URL}`);
//     supertest
//         .post("/martha_v2")
//         .set("Content-Type", "application/json")
//         .send({"url" : "dos://broad-dsp-dos.storage.googleapis.com/dos.json", "pattern" : "gs://"})
//         .expect((response) => {
//             t.is(response.statusCode, 200);
//             t.deepEqual(response.text, "gs://broad-public-datasets/NA12878_downsampled_for_testing/unmapped/H06JUADXX130110.1.ATCACGAT.20k_reads.bam");
//         })
//         .end(t.end);
// });

test.cb("smoketest_v2 return error if url passed is malformed", (t) => {
    supertest
        .post("/martha_v2")
        .set("Content-Type", "application/json")
        .send({"url" : "somethingNotValidURL"})
        .expect(400)
        .end(t.end);
});

test.cb("smoketest_v2 return error if url passed is not good", (t) => {
    supertest
        .post("/martha_v2")
        .set("Content-Type", "application/json")
        .send({"url" : "dos://broad-dsp-dos-TYPO.storage.googleapis.com/dos.json"})
        .expect(502)
        .end(t.end);
});

// TODO: This test cannot pass until Fence to enables Google Endpoints on their end so that when we call Bond, we can get an actual key
test.cb.failing("smoketest_v2 do thing", (t) => {
    // TODO: Authorize Bond to access Fence data on behalf of the user running this script
    // These smoketests can be run by anyone, but are intended to be part of the deployment process.  Therefore, the
    // user/SA that is running that script needs to have authorized Bond with Fence in order for this test to pass.
    let bearerToken = String(execSync("gcloud auth print-access-token")).trim();
    supertest
        .post("/martha_v2")
        .set("Content-Type", "application/json")
        .set("authorization", `bearer ${bearerToken}`)
        .send({"url": "dos://broad-dsp-dos.storage.googleapis.com/dos.json"})
        .expect(200)
        .expect((response) => {
            const results = JSON.parse(response.text);
            t.truthy(results.dos);
            t.truthy(results.googleServiceAccount);
        })
        .end(t.end);
});