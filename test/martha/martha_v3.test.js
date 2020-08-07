/**
 * When writing/testing GCF functions, see:
 * - https://cloud.google.com/functions/docs/monitoring/error-reporting
 * - https://cloud.google.com/functions/docs/bestpractices/testing
 *
 * NOTE: Any tests in this file that rely on the before/after stubs need to be run sequentially, see:
 * https://github.com/avajs/ava/issues/1066
 */

const test = require('ava');
const sinon = require('sinon');
const url = require('url');
const { marthaV3Handler: marthaV3, determineDrsType } = require('../../martha/martha_v3');
const apiAdapter = require('../../common/api_adapter');
const config = require('../../config.json');

const mockRequest = (req) => {
    req.method = 'POST';
    req.headers = { authorization: 'bearer abc123' };
    return req;
};

const mockResponse = () => {
    return {
        status(s) {
            this.statusCode = s;
            return this;
        },
        send: sinon.stub(),
        setHeader: sinon.stub()
    };
};

// Jade Data Repo DOS
const jadeDosResponse = {
    "data_object": {
        aliases: [],
        checksums: [
            {
                checksum: "8a366443",
                type: "crc32c"
            }, {
                checksum: "336ea55913bc261b72875bd259753046",
                type: "md5"
            }, {
                checksum: "f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44",
                type: "sha256"
            }

        ],
        created: "2020-04-27T15:56:09.696Z",
        description: "",
        id: "dg.4503/00e6cfa9-a183-42f6-bb44-b70347106bbe",
        mime_type: "",
        size: 15601108255,
        updated: "2020-04-27T15:56:09.696Z",
        urls: [
            {
                url: 'gs://broad-jade-dev-data-bucket/fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/8b07563a-542f-4b5c-9e00-e8fe6b1861de'
            }
        ],
        version: "6d60cacf"
    }
};

// Jade Data Repo DRS
const jadeDrsResponse = {
    id: 'v1_93dc1e76-8f1c-4949-8f9b-07a087f3ce7b_8b07563a-542f-4b5c-9e00-e8fe6b1861de',
    description: 'HG00096 BAM file',
    name: 'HG00096.mapped.ILLUMINA.bwa.GBR.low_coverage.20120522.bam',
    size: 15601108255,
    created_time: '2020-04-27T15:56:09.696Z', // eslint-disable-line camelcase
    updated_time: '2020-04-27T15:56:09.696Z', // eslint-disable-line camelcase
    version: '0',
    mime_type: 'application/octet-stream', // eslint-disable-line camelcase
    checksums: [
        {
            checksum: '336ea55913bc261b72875bd259753046',
            type: 'md5'
        },
        {
            checksum: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44',
            type: 'sha256'
        },
        {
            checksum: '8a366443',
            type: 'crc32c'
        }
    ],
    access_methods: [ // eslint-disable-line camelcase
        {
            type: 'gs',
            access_url: { // eslint-disable-line camelcase
                url:
                    'gs://broad-jade-dev-data-bucket/fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/' +
                    '8b07563a-542f-4b5c-9e00-e8fe6b1861de',
            }
        }
    ]
};

// https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit#
const gen3CrdcResponse = {
    access_methods:
        [
            {
                access_id: "gs",
                access_url:
                    {
                        url: "gs://gdc-tcga-phs000178-controlled/BRCA/RNA/RNA-Seq/UNC-LCCC/ILLUMINA/UNCID_2210188.c71ca9f7-248f-460c-b5d3-afb2c648fef2.110412_UNC13-SN749_0051_AB0168ABXX_4.tar.gz"
                    },
                region: "",
                type: "gs"
            },
            {
                access_id: "s3",
                access_url:
                    {
                        url: "s3://tcga-2-controlled/0027045b-9ed6-45af-a68e-f55037b5184c/UNCID_2210188.c71ca9f7-248f-460c-b5d3-afb2c648fef2.110412_UNC13-SN749_0051_AB0168ABXX_4.tar.gz"
                    },
                region: "",
                type: "s3"
            }
        ],
    aliases: [],
    checksums:
        [
            {
                checksum: "2edd5fdb4f1deac4ef2bdf969de9f8ad",
                type: "md5"
            }
        ],
    contents: [],
    created_time: "2018-06-27T10:28:06.398871",
    description: "",
    id: "0027045b-9ed6-45af-a68e-f55037b5184c",
    mime_type: "application/json",
    name: null,
    self_uri: "drs://nci-crdc.datacommons.io/0027045b-9ed6-45af-a68e-f55037b5184c",
    size: 6703858793,
    updated_time: "2018-06-27T10:28:06.398882",
    version: "5eb15d8b"
};

const bdcDrsResponse = {
    access_methods:
        [
            {
                access_id: "gs",
                access_url:
                    {
                        url: "gs://fc-56ac46ea-efc4-4683-b6d5-6d95bed41c5e/CCDG_13607/Project_CCDG_13607_B01_GRM_WGS.cram.2019-02-06/Sample_HG02014/analysis/HG02014.final.cram"
                    },
                region: "",
                type: "gs"
            }
        ],
    aliases: [],
    checksums:
        [
            {
                checksum: "bb193a5b603ae6ac5eb39890b6ca1bb5",
                type: "md5"
            }
        ],
    contents: [],
    created_time: "2020-01-15T15:35:09.184152",
    description: "",
    id: "dg.4503/fc046e84-6cf9-43a3-99cc-ffa2964b88cb",
    mime_type: "application/json",
    name: "",
    self_uri: "drs://gen3.biodatacatalyst.nhlbi.nih.gov/dg.4503/fc046e84-6cf9-43a3-99cc-ffa2964b88cb",
    size: 14772393959,
    updated_time: "2020-01-15T15:35:09.184160",
    version: "f443f632"
};

const anvilDrsResponse = {
    access_methods:
        [
            {
                access_id: "gs",
                access_url:
                    {
                        url: "gs://fc-secure-ff8156a3-ddf3-42e4-9211-0fd89da62108/GTEx_Analysis_2017-06-05_v8_RNAseq_bigWig_files/GTEX-1GZHY-0011-R6a-SM-9OSWL.Aligned.sortedByCoord.out.patched.md.bigWig"
                    },
                region: "",
                type: "gs"
            }
        ],
    aliases: [],
    checksums:
        [
            {
                checksum: "18156430a5eea715b9b58fb53d0cef99",
                type: "md5"
            }
        ],
    contents: [],
    created_time: "2020-07-08T18:52:53.194819",
    description: "",
    id: "dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0",
    mime_type: "application/json",
    name: "",
    self_uri: "drs://gen3.theanvil.io/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0",
    size: 143562155,
    updated_time: "2020-07-08T18:52:53.194826",
    version: "0a4262ff"
};

const kidsFirstDrsResponse = {
    "access_methods": [
        {
            "access_id": "s3",
            "access_url": {
                "uUrl":
                    "s3://kf-seq-data-washu/OrofacialCleft/fa9c2cb04f614f90b75323b05bfdd231.bam"
            },
            "region": "",
            "type": "s3"
        }
    ],
    "aliases": [

    ],
    "checksums": [
        {
            "Checksum":
                "24e5d5d0ddd094be0ffb672875b10576-6572",
            "type": "etag"
        }
    ],
    "contents": [

    ],
    "created_time": "2018-05-23T12:32:32.594470",
    "description": "",
    "id": "ed6be7ab-068e-46c8-824a-f39cfbb885cc",
    "mime_type": "application/json",
    "name": "fa9c2cb04f614f90b75323b05bfdd231.bam",
    "Self_uri":
        "drs://data.kidsfirstdrc.org/ed6be7ab-068e-46c8-824a-f39cfbb885cc",
    "size": 55121736836,
    "updated_time": "2018-05-23T12:32:32.594480",
    "version": "f70e5775"
};

const hcaDosResponse = {
    data_object:
        {
            id: "8aca942c-17f7-4e34-b8fd-3c12e50f9291",
            urls:
                [
                    {
                        url: "https://drs.data.humancellatlas.org/dss/files/8aca942c-17f7-4e34-b8fd-3c12e50f9291?version=2019-07-04T151444.185805Z&replica=aws&wait=1&fileName=SRR3879608_1.fastq.gz"
                    },
                    {
                        url: "gs://org-hca-dss-checkout-prod/blobs/44d320c9606e32d6df04d8a4023e6474efaa2f99de436e07f7241942972d5703.c3349268e528c844c528a427aa13034e72b7b39d.16c68f2306435b7cf990153b37adeb20-134.64d51664"
                    }
                ],
            size: "8933233597",
            checksums:
                [
                    {
                        checksum: "44d320c9606e32d6df04d8a4023e6474efaa2f99de436e07f7241942972d5703",
                        type: "sha256"
                    }
                ],
            aliases:
                [
                    "SRR3879608_1.fastq.gz"
                ],
            version: "2019-07-04T151444.185805Z",
            name: "SRR3879608_1.fastq.gz"
        }
};

const bdcDrsMarthaResult = {
    contentType: 'application/json',
    size: 14772393959,
    timeCreated: '2020-01-15T20:35:09.184Z',
    timeUpdated: '2020-01-15T20:35:09.184Z',
    bucket: 'fc-56ac46ea-efc4-4683-b6d5-6d95bed41c5e',
    name: 'CCDG_13607/Project_CCDG_13607_B01_GRM_WGS.cram.2019-02-06/Sample_HG02014/analysis/HG02014.final.cram',
    gsUri:
        'gs://fc-56ac46ea-efc4-4683-b6d5-6d95bed41c5e/CCDG_13607/Project_CCDG_13607_B01_GRM_WGS.cram.2019-02-06/Sample_HG02014/analysis/HG02014.final.cram',
    googleServiceAccount: null,
    hashes: {
        md5: 'bb193a5b603ae6ac5eb39890b6ca1bb5'
    }
};

const jadeDosMarthaResult = (expectedGoogleServiceAccount) => {
    return {
        contentType: 'application/octet-stream',
        size: 15601108255,
        timeCreated: '2020-04-27T15:56:09.696Z',
        timeUpdated: '2020-04-27T15:56:09.696Z',
        bucket: 'broad-jade-dev-data-bucket',
        name: 'fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/8b07563a-542f-4b5c-9e00-e8fe6b1861de',
        gsUri:
            'gs://broad-jade-dev-data-bucket/fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/8b07563a-542f-4b5c-9e00-e8fe6b1861de',
        googleServiceAccount: expectedGoogleServiceAccount,
        hashes: {
            md5: '336ea55913bc261b72875bd259753046',
            sha256: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44',
            crc32c: '8a366443'
        }
    };
};

const gen3CrdcDrsMarthaResult = (expectedGoogleServiceAccount) => {
    return {
        contentType: 'application/json',
        size: 6703858793,
        timeCreated: '2018-06-27T14:28:06.398Z',
        timeUpdated: '2018-06-27T14:28:06.398Z',
        bucket: 'gdc-tcga-phs000178-controlled',
        name: 'BRCA/RNA/RNA-Seq/UNC-LCCC/ILLUMINA/UNCID_2210188.c71ca9f7-248f-460c-b5d3-afb2c648fef2.110412_UNC13-SN749_0051_AB0168ABXX_4.tar.gz',
        gsUri:
            'gs://gdc-tcga-phs000178-controlled/BRCA/RNA/RNA-Seq/UNC-LCCC/ILLUMINA/UNCID_2210188.c71ca9f7-248f-460c-b5d3-afb2c648fef2.110412_UNC13-SN749_0051_AB0168ABXX_4.tar.gz',
        googleServiceAccount: expectedGoogleServiceAccount,
        hashes: {
            md5: '2edd5fdb4f1deac4ef2bdf969de9f8ad'
        }
    };
};

const anvilDrsMarthaResult = (expectedGoogleServiceAccount) => {
    return {
        contentType: 'application/json',
        size: 143562155,
        timeCreated: '2020-07-08T22:52:53.194Z',
        timeUpdated: '2020-07-08T22:52:53.194Z',
        bucket: 'fc-secure-ff8156a3-ddf3-42e4-9211-0fd89da62108',
        name: 'GTEx_Analysis_2017-06-05_v8_RNAseq_bigWig_files/GTEX-1GZHY-0011-R6a-SM-9OSWL.Aligned.sortedByCoord.out.patched.md.bigWig',
        gsUri:
            'gs://fc-secure-ff8156a3-ddf3-42e4-9211-0fd89da62108/GTEx_Analysis_2017-06-05_v8_RNAseq_bigWig_files/GTEX-1GZHY-0011-R6a-SM-9OSWL.Aligned.sortedByCoord.out.patched.md.bigWig',
        googleServiceAccount: expectedGoogleServiceAccount,
        hashes: {
            md5: '18156430a5eea715b9b58fb53d0cef99'
        }
    };
};

const kidsFirstDrsMarthaResult = (expectedGoogleServiceAccount) => {
    return {
        contentType: 'application/json',
        size: 55121736836,
        timeCreated: '2018-05-23T16:32:32.594Z',
        timeUpdated: '2018-05-23T16:32:32.594Z',
        bucket: null, // expected, uses S3
        name: null, // there is definitely a name in the server response, why isn't Martha using it?
        gsUri: null, // expected, uses S3
        googleServiceAccount: expectedGoogleServiceAccount,
        hashes: {
            etag: undefined
        }
    };
};

// Quite a grim result, but could be working as expected?
const hcaDosMarthaResult = (expectedGoogleServiceAccount) => {
    return {
        contentType: 'application/octet-stream',
        size: null,
        timeCreated: null,
        timeUpdated: null,
        bucket: null,
        name: null,
        gsUri: null,
        googleServiceAccount: expectedGoogleServiceAccount,
        hashes: null
    };
};

const dosObjectWithMissingFields = {
    "data_object": {
        id: 'v1_abc-123',
        description: '123 BAM file',
        name: '123.mapped.abc.bam',
        created: '2020-04-27T15:56:09.696Z',
        version: '0',
        mime_type: 'application/octet-stream',
        size: 123456
    }
};

const expectedObjWithMissingFields = {
    contentType: 'application/octet-stream',
    size: 123456,
    timeCreated: '2020-04-27T15:56:09.696Z',
    timeUpdated: null,
    bucket: null,
    name: null,
    gsUri: null,
    googleServiceAccount: null,
    hashes: null
};

const googleSAKeyObject = { key: 'A Google Service Account private key json object' };

const bondRegEx = /^([^/]+)\/api\/link\/v1\/([a-z-]+)\/serviceaccount\/key$/;

let getJsonFromApiStub;
const getJsonFromApiMethodName = 'getJsonFrom';
const sandbox = sinon.createSandbox();

test.serial.beforeEach(() => {
    sandbox.restore(); // If one test fails, the .afterEach() block will not execute, so always clean the slate here
    getJsonFromApiStub = sandbox.stub(apiAdapter, getJsonFromApiMethodName);
    getJsonFromApiStub.onSecondCall().resolves(googleSAKeyObject);
});

test.serial.afterEach(() => {
    sandbox.restore();
});

test.serial('martha_v3 resolves a valid DOS-style url', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(Object.assign({}, result), jadeDosMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 resolves a valid DRS-style url', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(Object.assign({}, result), jadeDosMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 resolves successfully and ignores extra data submitted besides a \'url\'', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({
        body: {
            url: 'dos://abc/123',
            pattern: 'gs://',
            foo: 'bar'
        }
    }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(Object.assign({}, result), jadeDosMarthaResult(googleSAKeyObject));
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 should return 400 if a Data Object without authorization header is provided', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDosResponse);
    const response = mockResponse();
    const mockReq = mockRequest({ body: { 'url': 'dos://abc/123' } });
    delete mockReq.headers.authorization;
    await marthaV3(mockReq, response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. Authorization header is missing.');
});

test.serial('martha_v3 should return 400 if not given a url', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'uri': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. URL of a DRS object is missing.');
});

test.serial('martha_v3 should return 400 if no data is posted with the request', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({}), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, 'Request is invalid. URL of a DRS object is missing.');
});

test.serial('martha_v3 should return 400 if given a \'url\' with an invalid value', async (t) => {
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { url: 'Not a valid URI' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 400);
    t.is(result.status, 400);
    t.is(result.response.text, '"Not a valid URI" is not a properly-formatted URI.');
});

test.serial('martha_v3 should return 500 if Data Object resolution fails', async (t) => {
    getJsonFromApiStub.restore();
    sandbox.stub(apiAdapter, getJsonFromApiMethodName).rejects(new Error('Data Object Resolution forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 500);
    t.is(result.status, 500);
    t.is(result.response.text, 'Received error while resolving DRS URL. Data Object Resolution forced to fail by testing stub');
});

test.serial('martha_v3 should return 500 if key retrieval from bond fails', async (t) => {
    getJsonFromApiStub.restore();
    sandbox.stub(apiAdapter, getJsonFromApiMethodName).rejects(new Error('Bond key lookup forced to fail by testing stub'));
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.is(response.statusCode, 500);
    t.is(result.status, 500);
    t.is(result.response.text, 'Received error while resolving DRS URL. Bond key lookup forced to fail by testing stub');
});

test.serial('martha_v3 calls bond Bond with the "dcf-fence" provider when the Data Object URL host is not "dg.4503"', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://abc/123' } }), response);
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'dcf-fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 calls bond Bond with the "fence" provider when the Data Object URL host is "dg.4503"', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://dg.4503/this_part_can_be_anything' } }), response);
    const requestedBondUrl = getJsonFromApiStub.secondCall.args[0];
    const matches = requestedBondUrl.match(bondRegEx);
    t.truthy(matches, 'Bond URL called does not match Bond URL regular expression');
    const expectedProvider = 'fence';
    const actualProvider = matches[2];
    t.is(actualProvider, expectedProvider);
});

test.serial('martha_v3 does not call Bond or return SA key when the Data Object URL host endswith ".humancellatlas.org', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://someservice.humancellatlas.org/this_part_can_be_anything' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), jadeDosMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 does not call Bond or return SA key when the host url is for jade data repo', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(jadeDrsResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), jadeDosMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses Gen3 CRDC response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(gen3CrdcResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), gen3CrdcDrsMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses BDC response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(bdcDrsResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), bdcDrsMarthaResult);
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses Anvil response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(anvilDrsResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), anvilDrsMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses Kids First response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(kidsFirstDrsResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), kidsFirstDrsMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 parses HCA response correctly', async (t) => {
    getJsonFromApiStub.onFirstCall().resolves(hcaDosResponse);
    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'dos://jade.datarepo-dev.broadinstitute.org/abc' } }), response);
    const result = response.send.lastCall.args[0];
    t.true(getJsonFromApiStub.calledOnce); // Bond was not called to get SA key
    t.deepEqual(Object.assign({}, result), hcaDosMarthaResult(null));
    t.falsy(result.googleServiceAccount);
    t.is(response.statusCode, 200);
});

test.serial('martha_v3 returns null for fields missing in drs and bond response', async (t) => {
    // update the stub to return DRS response with missing fields only for this test
    sandbox.restore();
    getJsonFromApiStub.onFirstCall().resolves(jadeDosResponse);
    getJsonFromApiStub = sandbox.stub(apiAdapter, getJsonFromApiMethodName);
    getJsonFromApiStub.onFirstCall().resolves(dosObjectWithMissingFields);
    getJsonFromApiStub.onSecondCall().resolves(null);

    const response = mockResponse();
    await marthaV3(mockRequest({ body: { 'url': 'drs://abc/123' } }), response);
    const result = response.send.lastCall.args[0];
    t.deepEqual(Object.assign({}, result), expectedObjWithMissingFields);
    t.is(response.statusCode, 200);
});


/**
 * determineDrsType(uri) -> drsUrl Scenario 1: data objects uri with non-dg host and path
 */
test('determineDrsType should parse dos:// Data Object uri', (t) => {
    t.is(determineDrsType(url.parse('dos://fo.o/bar')).drsUrl, 'https://fo.o/ga4gh/dos/v1/dataobjects/bar');
});

test('determineDrsType should parse drs:// Data Object uri', (t) => {
    t.is(determineDrsType(url.parse('drs://fo.o/bar')).drsUrl, 'https://fo.o/ga4gh/dos/v1/dataobjects/bar');
});

test('determineDrsType should parse drs:// Data Object uri with query part', (t) => {
    t.is(determineDrsType(url.parse('drs://fo.o/bar?version=1&bananas=yummy')).drsUrl, 'https://fo.o/ga4gh/dos/v1/dataobjects/bar?version=1&bananas=yummy');
});

test('determineDrsType should parse drs:// Data Object uri when host includes a port number', (t) => {
    t.is(determineDrsType(url.parse('drs://foo.com:1234/bar')).drsUrl, 'https://foo.com:1234/ga4gh/dos/v1/dataobjects/bar');
});
/**
 * End Scenario 1
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 2: data objects uri with dg host
 */
test('dataObjectUriToHttps should parse "dos://" Data Object uri with a host and path', (t) => {
    t.is(determineDrsType(url.parse('dos://dg.2345/bar')).drsUrl, `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('dataObjectUriToHttps should parse "drs://" Data Object uri with a host and path', (t) => {
    t.is(determineDrsType(url.parse('drs://dg.2345/bar')).drsUrl, `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('dataObjectUriToHttps should parse "drs://dg." Data Object uri with query part', (t) => {
    t.is(determineDrsType(url.parse('drs://dg.2345/bar?version=1&bananas=yummy')).drsUrl, `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.2345/bar?version=1&bananas=yummy`);
});
/**
 * End Scenario 2
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 3: data objects uri with non-dg host and NO path
 */
test('should parse "dos://dg." Data Object uri with only a host part without a path', (t) => {
    t.is(determineDrsType(url.parse('dos://dg.baz')).drsUrl, `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.baz`);
});

test('should parse "drs://foo-bar.baz" Data Object uri with only a host part without a path', (t) => {
    t.is(determineDrsType(url.parse('drs://foo-bar.baz')).drsUrl, `https://foo-bar.baz/ga4gh/dos/v1/dataobjects/foo-bar.baz`);
});

test('should parse "drs://dg." Data Object uri with only a host part with a query part', (t) => {
    t.is(determineDrsType(url.parse('drs://dg.foo-bar-baz?version=1&bananas=yummy')).drsUrl, `https://${config.dataObjectResolutionHost}/ga4gh/dos/v1/dataobjects/dg.foo-bar-baz?version=1&bananas=yummy`);
});
/**
 * End Scenario 3
 */

/**
 * determineDrsType(uri) -> drsUrl Scenario 4: data objects uri with jade data repo host
 */
test('should parse Data Object uri with jade data repo DEV as host', (t) => {
    t.is(
        determineDrsType(url.parse('drs://jade.datarepo-dev.broadinstitute.org/973b5e79-6433-40ce-bf38-686ab7f17820')).drsUrl,
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test('should parse Data Object uri with jade data repo DEV as host and path with snapshot id', (t) => {
    t.is(
        determineDrsType(url.parse('drs://jade.datarepo-dev.broadinstitute.org/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820')).drsUrl,
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test('should parse Data Object uri with jade data repo PROD as host', (t) => {
    t.is(
        determineDrsType(url.parse('drs://jade-terra.datarepo-prod.broadinstitute.org/anything')).drsUrl,
        'https://jade-terra.datarepo-prod.broadinstitute.org/ga4gh/drs/v1/objects/anything'
    );
});

test('should parse Data Object uri with host that looks like jade data repo host', (t) => {
    t.is(
        determineDrsType(url.parse('drs://jade-data-repo.datarepo-dev.broadinstitute.org/v1_anything')).drsUrl,
        'https://jade-data-repo.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_anything'
    );
});
/**
 * End Scenario 4
 */
