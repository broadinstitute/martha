const test = require('ava');
const sinon = require('sinon');
const config = require('../../common/config');
const helpers = require('./_helpers.js')

const { marthaV3Handler: marthaV3 } = require('../../martha/martha_v3');
const apiAdapter = require('../../common/api_adapter');

const terraAuth = "Bearer XYZ_TerraAuthToken";
const bucketId = "bucket_id";
const responseId = `v1_ResponseId_${bucketId}`;
const gsAccessId = "gcp-us-central1";
const gsUrl = `gs://broad-jade-dev-data-bucket/BucketIdPrefix/${bucketId}`;
const drsUri = `drs://${config.HOST_TDR_DEV}/${responseId}`


const jadeAccessUrlMetadataResponse = {
  "id": `${responseId}`,
  "access_methods": [
    {
      "type": "gs",
      "access_id": `${gsAccessId}`,
    },
  ],
};


test.serial.beforeEach(() => {
  sinon.restore();
  getJsonFromApiStub = sinon.stub(apiAdapter, "getJsonFrom");
});


test.serial('(custom) martha_v3 calls the correct endpoints when access url fetch is forced for TDR', async (t) => {  
    const drs = helpers.drsUrls(
      config.HOST_TDR_DEV, 
      responseId,
      gsAccessId,
    );
    
    // 2021-10-04 Jade returns `"headers": null` if there are no headers, 
    // while the Gen3 repos we have worked with to date omit the "headers" kv completely.
    const drsAccessUrlResponse = {...helpers.mockGcsAccessUrl(gsUrl), 'headers': null};

    getJsonFromApiStub.withArgs(drs.objectsUrl, terraAuth).resolves(jadeAccessUrlMetadataResponse);
    getJsonFromApiStub.withArgs(drs.accessUrl, terraAuth).resolves(drsAccessUrlResponse);

    const request = helpers.mockRequest(
      {
        body: {
          url: drsUri, 
          fields: ['accessUrl']
        }
      },
      options={
        forceAccessUrl: true
      },
      auth=terraAuth,
    );
    const response = helpers.mockResponse();
    await marthaV3(request, response);

    t.is(response.statusCode, 200);
    t.deepEqual(response.body, { accessUrl: drsAccessUrlResponse });

    sinon.assert.callCount(getJsonFromApiStub, 2);
});

