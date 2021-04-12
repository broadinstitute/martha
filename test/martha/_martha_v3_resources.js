// Most sample DRS server responses in this file originate in this document:
// https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit#
//
// The leading _ in the filename prevents `ava` from looking for tests in it

// Invalid example

const config = require('../../common/config');

const dosObjectWithMissingFields = {
    data_object: {
        id: 'v1_abc-123',
        description: '123 BAM file',
        name: '123.mapped.abc.bam',
        created: '2020-04-27T15:56:09.696Z',
        version: '0',
        mime_type: 'application/octet-stream',
        size: 123456
    }
};

const dosObjectWithInvalidFields = {
    data_object: {
        urls: 'gs://i/should/have/been/an/array',
    }
};

const drsObjectWithInvalidFields = {
    access_methods: { oops: 'i should have been an array' },
};

const expectedObjWithMissingFields = {
    contentType: 'application/octet-stream',
    size: 123456,
    timeCreated: '2020-04-27T15:56:09.696Z',
    timeUpdated: null,
    bucket: null,
    name: null,
    accessUrl: null,
    gsUri: null,
    googleServiceAccount: null,
    bondProvider: 'dcf-fence',
    fileName: '123.mapped.abc.bam',
    hashes: null
};

// Unaffiliated DOS examples

const sampleDosResponse = {
    data_object: {
        aliases: [],
        checksums: [
            {
                checksum: '8a366443',
                type: 'crc32c'
            }, {
                checksum: '336ea55913bc261b72875bd259753046',
                type: 'md5'
            }, {
                checksum: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44',
                type: 'sha256'
            }

        ],
        created: '2020-04-27T15:56:09.696Z',
        description: '',
        id: 'dg.4503/00e6cfa9-a183-42f6-bb44-b70347106bbe',
        mime_type: '',
        size: 15601108255,
        updated: '2020-04-27T15:56:09.696Z',
        urls: [
            {
                url: 'gs://bogus/my_data'
            }
        ],
        version: '6d60cacf'
    }
};

const sampleDosMarthaResult = (expectedGoogleServiceAccount) => {
    return {
        contentType: 'application/octet-stream',
        size: 15601108255,
        timeCreated: '2020-04-27T15:56:09.696Z',
        timeUpdated: '2020-04-27T15:56:09.696Z',
        bucket: 'bogus',
        name: 'my_data',
        gsUri: 'gs://bogus/my_data',
        googleServiceAccount: expectedGoogleServiceAccount,
        bondProvider: 'dcf-fence',
        fileName: 'my_data',
        accessUrl: null,
        hashes: {
            md5: '336ea55913bc261b72875bd259753046',
            sha256: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44',
            crc32c: '8a366443'
        }
    };
};

// dataguids.org
// returned via `curl https://dataguids.org/ga4gh/dos/v1/dataobjects/a41b0c4f-ebfb-4277-a941-507340dea85d`
const dataGuidsOrgResponse = {
    data_object: {
        checksums: [
            {
                checksum: '0d22c86537e22ad9e924c7c756b23131',
                type: 'md5'
            }
        ],
        created: '2018-06-26T18:53:21.416896',
        description: '',
        id: 'a41b0c4f-ebfb-4277-a941-507340dea85d',
        mime_type: '',
        name: null,
        size: 39830,
        updated: '2018-06-26T18:53:21.416908',
        urls: [
            {
                'url':
                    'gs://gdc-tcga-phs000178-open/a41b0c4f-ebfb-4277-a941-507340dea85d' +
                    '/nationwidechildrens.org_clinical.TCGA-56-A4BY.xml'
            },
            {
                'url':
                    's3://tcga-2-open/a41b0c4f-ebfb-4277-a941-507340dea85d' +
                    '/nationwidechildrens.org_clinical.TCGA-56-A4BY.xml'
            }
        ],
        version: 'a095f638'
    }
};

const dataGuidsOrgMarthaResult = (expectedGoogleServiceAccount) => {
    return {
        contentType: 'application/octet-stream',
        size: 39830,
        timeCreated: '2018-06-26T18:53:21.416Z',
        timeUpdated: '2018-06-26T18:53:21.416Z',
        bucket: 'gdc-tcga-phs000178-open',
        name: 'a41b0c4f-ebfb-4277-a941-507340dea85d/nationwidechildrens.org_clinical.TCGA-56-A4BY.xml',
        accessUrl: null,
        gsUri:
            'gs://gdc-tcga-phs000178-open/a41b0c4f-ebfb-4277-a941-507340dea85d' +
            '/nationwidechildrens.org_clinical.TCGA-56-A4BY.xml',
        googleServiceAccount: expectedGoogleServiceAccount,
        bondProvider: 'dcf-fence',
        fileName: 'nationwidechildrens.org_clinical.TCGA-56-A4BY.xml',
        hashes: {
            md5: '0d22c86537e22ad9e924c7c756b23131'
        }
    };
};

// Jade

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

const jadeDrsMarthaResult = {
    contentType: 'application/octet-stream',
    size: 15601108255,
    timeCreated: '2020-04-27T15:56:09.696Z',
    timeUpdated: '2020-04-27T15:56:09.696Z',
    bucket: 'broad-jade-dev-data-bucket',
    name: 'fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/8b07563a-542f-4b5c-9e00-e8fe6b1861de',
    accessUrl: null,
    gsUri:
        'gs://broad-jade-dev-data-bucket/fd8d8492-ad02-447d-b54e-35a7ffd0e7a5/8b07563a-542f-4b5c-9e00-e8fe6b1861de',
    googleServiceAccount: null,
    bondProvider: null,
    fileName: 'HG00096.mapped.ILLUMINA.bwa.GBR.low_coverage.20120522.bam',
    hashes: {
        md5: '336ea55913bc261b72875bd259753046',
        sha256: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44',
        crc32c: '8a366443'
    }
};

// Gen3/CRDC

const gen3CrdcResponse = {
    access_methods:
        [
            {
                access_id: 'gs',
                access_url:
                    {
                        url: 'gs://gdc-tcga-phs000178-controlled/BRCA/RNA/RNA-Seq/UNC-LCCC/ILLUMINA/UNCID_2210188.c71ca9f7-248f-460c-b5d3-afb2c648fef2.110412_UNC13-SN749_0051_AB0168ABXX_4.tar.gz'
                    },
                region: '',
                type: 'gs'
            },
            {
                access_id: 's3',
                access_url:
                    {
                        url: 's3://tcga-2-controlled/0027045b-9ed6-45af-a68e-f55037b5184c/UNCID_2210188.c71ca9f7-248f-460c-b5d3-afb2c648fef2.110412_UNC13-SN749_0051_AB0168ABXX_4.tar.gz'
                    },
                region: '',
                type: 's3'
            }
        ],
    aliases: [],
    checksums:
        [
            {
                checksum: '2edd5fdb4f1deac4ef2bdf969de9f8ad',
                type: 'md5'
            }
        ],
    contents: [],
    created_time: '2018-06-27T10:28:06.398871',
    description: '',
    id: '0027045b-9ed6-45af-a68e-f55037b5184c',
    mime_type: 'application/json',
    name: null,
    self_uri: `drs://${config.HOST_CRDC_PROD}/0027045b-9ed6-45af-a68e-f55037b5184c`,
    size: 6703858793,
    updated_time: '2018-06-27T10:28:06.398882',
    version: '5eb15d8b'
};

const gen3CrdcDrsMarthaResult = (expectedGoogleServiceAccount, expectedAccessUrl) => { return {
    contentType: 'application/json',
    size: 6703858793,
    timeCreated: '2018-06-27T10:28:06.398Z',
    timeUpdated: '2018-06-27T10:28:06.398Z',
    bucket: 'gdc-tcga-phs000178-controlled',
    name:
        'BRCA/RNA/RNA-Seq/UNC-LCCC/ILLUMINA' +
        '/UNCID_2210188.c71ca9f7-248f-460c-b5d3-afb2c648fef2.110412_UNC13-SN749_0051_AB0168ABXX_4.tar.gz',
    accessUrl: expectedAccessUrl,
    gsUri:
        'gs://gdc-tcga-phs000178-controlled/BRCA/RNA/RNA-Seq/UNC-LCCC/ILLUMINA' +
        '/UNCID_2210188.c71ca9f7-248f-460c-b5d3-afb2c648fef2.110412_UNC13-SN749_0051_AB0168ABXX_4.tar.gz',
    googleServiceAccount: expectedGoogleServiceAccount,
    bondProvider: 'dcf-fence',
    fileName: 'UNCID_2210188.c71ca9f7-248f-460c-b5d3-afb2c648fef2.110412_UNC13-SN749_0051_AB0168ABXX_4.tar.gz',
    hashes: {
        md5: '2edd5fdb4f1deac4ef2bdf969de9f8ad'
    }
}; };

// Anvil

const anvilDrsResponse = {
    access_methods:
        [
            {
                access_id: 'gs',
                access_url:
                    {
                        url: 'gs://fc-secure-ff8156a3-ddf3-42e4-9211-0fd89da62108/GTEx_Analysis_2017-06-05_v8_RNAseq_bigWig_files/GTEX-1GZHY-0011-R6a-SM-9OSWL.Aligned.sortedByCoord.out.patched.md.bigWig'
                    },
                region: '',
                type: 'gs'
            }
        ],
    aliases: [],
    checksums:
        [
            {
                checksum: '18156430a5eea715b9b58fb53d0cef99',
                type: 'md5'
            }
        ],
    contents: [],
    created_time: '2020-07-08T18:52:53.194819',
    description: '',
    id: 'dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0',
    mime_type: 'application/json',
    name: '',
    self_uri: `drs://${config.HOST_THE_ANVIL_PROD}/dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`,
    size: 143562155,
    updated_time: '2020-07-08T18:52:53.194826',
    version: '0a4262ff'
};

const anvilDrsMarthaResult = (expectedGoogleServiceAccount, expectedAccessUrl) => {
    return {
        contentType: 'application/json',
        size: 143562155,
        timeCreated: '2020-07-08T18:52:53.194Z',
        timeUpdated: '2020-07-08T18:52:53.194Z',
        bucket: 'fc-secure-ff8156a3-ddf3-42e4-9211-0fd89da62108',
        name:
            'GTEx_Analysis_2017-06-05_v8_RNAseq_bigWig_files' +
            '/GTEX-1GZHY-0011-R6a-SM-9OSWL.Aligned.sortedByCoord.out.patched.md.bigWig',
        accessUrl: expectedAccessUrl,
        gsUri:
            'gs://fc-secure-ff8156a3-ddf3-42e4-9211-0fd89da62108/GTEx_Analysis_2017-06-05_v8_RNAseq_bigWig_files' +
            '/GTEX-1GZHY-0011-R6a-SM-9OSWL.Aligned.sortedByCoord.out.patched.md.bigWig',
        googleServiceAccount: expectedGoogleServiceAccount,
        bondProvider: 'anvil',
        fileName: 'GTEX-1GZHY-0011-R6a-SM-9OSWL.Aligned.sortedByCoord.out.patched.md.bigWig',
        hashes: {
            md5: '18156430a5eea715b9b58fb53d0cef99'
        }
    };
};

// Kids First

const kidsFirstDrsResponse = {
    access_methods: [
        {
            access_id: 's3',
            access_url: {
                url:
                    's3://kf-seq-data-washu/OrofacialCleft/fa9c2cb04f614f90b75323b05bfdd231.bam'
            },
            region: '',
            type: 's3'
        }
    ],
    aliases: [

    ],
    checksums: [
        {
            Checksum:
                '24e5d5d0ddd094be0ffb672875b10576-6572',
            type: 'etag'
        }
    ],
    contents: [

    ],
    created_time: '2018-05-23T12:32:32.594470',
    description: '',
    id: 'ed6be7ab-068e-46c8-824a-f39cfbb885cc',
    mime_type: 'application/json',
    name: 'fa9c2cb04f614f90b75323b05bfdd231.bam',
    self_uri:
        `drs://${config.HOST_KIDS_FIRST_PROD}/ed6be7ab-068e-46c8-824a-f39cfbb885cc`,
    size: 55121736836,
    updated_time: '2018-05-23T12:32:32.594480',
    version: 'f70e5775'
};

const kidsFirstDrsMarthaResult = (expectedAccessUrl) => {
    return {
        contentType: 'application/json',
        size: 55121736836,
        timeCreated: '2018-05-23T12:32:32.594Z',
        timeUpdated: '2018-05-23T12:32:32.594Z',
        bucket: null, // expected, uses S3
        name: null, // there is definitely a name in the server response, why isn't Martha using it?
        accessUrl: expectedAccessUrl,
        gsUri: null, // expected, uses S3
        googleServiceAccount: null,
        bondProvider: 'kids-first',
        fileName: 'fa9c2cb04f614f90b75323b05bfdd231.bam',
        hashes: {
            // This case captures current Martha behavior, selectively allow `undefined`
            etag: undefined // eslint-disable-line no-undefined
        }
    };
};

// BDC

const bdcDrsResponse = {
    access_methods:
        [
            {
                access_id: 'gs',
                access_url:
                    {
                        url: 'gs://fc-56ac46ea-efc4-4683-b6d5-6d95bed41c5e/CCDG_13607/Project_CCDG_13607_B01_GRM_WGS.cram.2019-02-06/Sample_HG01131/analysis/HG01131.final.cram.crai'
                    },
                region: '',
                type: 'gs'
            }
        ],
    aliases: [],
    checksums:
        [
            {
                checksum: '8bec761c8a626356eb34dbdfe20649b4',
                type: 'md5'
            }
        ],
    contents: [],
    created_time: '2020-01-15T17:46:25.694142',
    description: '',
    id: 'dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0',
    mime_type: 'application/json',
    name: null,
    self_uri: `drs://${config.HOST_BIODATA_CATALYST_STAGING}/dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0`,
    size: 1386553,
    updated_time: '2020-01-15T17:46:25.694148',
    version: 'd87455aa'
};

// Allow customizing parts of the bdc file response
const bdcDrsResponseCustom = (
    {
        name = bdcDrsResponse.name,
        access_url = { url: bdcDrsResponse.access_methods[0].access_url.url },
        access_id = bdcDrsResponse.access_methods[0].access_id,
    }
) => {
    return {
        ...bdcDrsResponse,
        name,
        access_methods:
            [
                {
                    access_id,
                    access_url,
                    type: bdcDrsResponse.access_methods[0].type,
                    region: bdcDrsResponse.access_methods[0].region,
                },
            ],
    };
};

const bdcDrsMarthaResult = (expectedGoogleServiceAccount, expectedAccessUrl) => {
    return {
        contentType: 'application/json',
        size: 1386553,
        timeCreated: '2020-01-15T17:46:25.694Z',
        timeUpdated: '2020-01-15T17:46:25.694Z',
        bucket: 'fc-56ac46ea-efc4-4683-b6d5-6d95bed41c5e',
        name: 'CCDG_13607/Project_CCDG_13607_B01_GRM_WGS.cram.2019-02-06/Sample_HG01131/analysis/HG01131.final.cram.crai',
        gsUri:
            'gs://fc-56ac46ea-efc4-4683-b6d5-6d95bed41c5e' +
            '/CCDG_13607' +
            '/Project_CCDG_13607_B01_GRM_WGS.cram.2019-02-06' +
            '/Sample_HG01131' +
            '/analysis' +
            '/HG01131.final.cram.crai',
        googleServiceAccount: expectedGoogleServiceAccount,
        bondProvider: 'fence',
        fileName: 'HG01131.final.cram.crai',
        hashes: {
            md5: '8bec761c8a626356eb34dbdfe20649b4'
        },
        accessUrl: expectedAccessUrl
    };
};

// HCA
// returned via
//   `curl https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_4641bafb-5190-425b-aea9-9c7b125515c8_e37266ba-790d-4641-aa76-854d94be2fbe`
const fakeToken = 'Definitely not a real token';
const hcaDrsResponse = {
    id: 'v1_4641bafb-5190-425b-aea9-9c7b125515c8_e37266ba-790d-4641-aa76-854d94be2fbe',
    name: 'E18_20161004_Neurons_Sample_49_S048_L004_R2_005.fastq.gz',
    self_uri: null,
    size: 438932948,
    created_time: '2020-12-17T21:01:25.906Z',
    updated_time: '2020-12-17T21:01:25.906Z',
    version: '0',
    mime_type: null,
    checksums: [
        {
            checksum: '5acd55ef',
            type: 'crc32c'
        }
    ],
    access_methods: [
        {
            type: 'gs',
            access_url: {
                url: 'gs://broad-jade-dev-data-bucket/ecb5601e-9026-428c-b49d-3c5f1807ecb7/e37266ba-790d-4641-aa76-854d94be2fbe/E18_20161004_Neurons_Sample_49_S048_L004_R2_005.fastq.gz',
                headers: null
            },
            access_id: null,
            region: 'us-central1'
        },
        {
            type: 'https',
            access_url: {
                url: 'https://www.googleapis.com/storage/v1/b/broad-jade-dev-data-bucket/o/ecb5601e-9026-428c-b49d-3c5f1807ecb7%2Fe37266ba-790d-4641-aa76-854d94be2fbe%2FE18_20161004_Neurons_Sample_49_S048_L004_R2_005.fastq.gz?alt=media',
                headers: [
                    `Authorization: Bearer ${fakeToken}`
                ]
            },
            access_id: null,
            region: 'us-central1'
        }
    ],
    contents: null,
    description: null,
    aliases: [
        '/hca_dev_20201217_test4/5acd55ef/E18_20161004_Neurons_Sample_49_S048_L004_R2_005.fastq.gz'
    ]
};

const hcaDrsMarthaResult = {
    bondProvider: null,
    gsUri: 'gs://broad-jade-dev-data-bucket/ecb5601e-9026-428c-b49d-3c5f1807ecb7/e37266ba-790d-4641-aa76-854d94be2fbe/E18_20161004_Neurons_Sample_49_S048_L004_R2_005.fastq.gz',
    bucket: 'broad-jade-dev-data-bucket',
    name: 'ecb5601e-9026-428c-b49d-3c5f1807ecb7/e37266ba-790d-4641-aa76-854d94be2fbe/E18_20161004_Neurons_Sample_49_S048_L004_R2_005.fastq.gz',
    accessUrl: null,
    fileName: 'E18_20161004_Neurons_Sample_49_S048_L004_R2_005.fastq.gz',
    contentType: null,
    size: 438932948,
    hashes: {
        crc32c: '5acd55ef'
    },
    timeCreated: '2020-12-17T21:01:25.906Z',
    timeUpdated: '2020-12-17T21:01:25.906Z',
    googleServiceAccount: null
};

module.exports = {
    expectedObjWithMissingFields,
    dosObjectWithMissingFields,
    dosObjectWithInvalidFields,
    drsObjectWithInvalidFields,
    sampleDosResponse,
    sampleDosMarthaResult,
    dataGuidsOrgResponse,
    dataGuidsOrgMarthaResult,
    jadeDrsResponse,
    jadeDrsMarthaResult,
    hcaDrsResponse,
    hcaDrsMarthaResult,
    bdcDrsResponse,
    bdcDrsResponseCustom,
    bdcDrsMarthaResult,
    anvilDrsResponse,
    anvilDrsMarthaResult,
    gen3CrdcResponse,
    gen3CrdcDrsMarthaResult,
    kidsFirstDrsResponse,
    kidsFirstDrsMarthaResult
};
