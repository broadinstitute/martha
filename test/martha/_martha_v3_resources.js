// Most sample DRS server responses in this file originate in this document:
// https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit#
//
// The leading _ in the filename prevents `ava` from looking for tests in it

// Invalid example

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

// Unaffiliated DOS examples

const sampleDosResponse = {
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
                url: 'gs://bogus/my_data'
            }
        ],
        version: "6d60cacf"
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
        gsUri:
            'gs://bogus/my_data',
        googleServiceAccount: expectedGoogleServiceAccount,
        hashes: {
            md5: '336ea55913bc261b72875bd259753046',
            sha256: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44',
            crc32c: '8a366443'
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

const jadeDrsMarthaResult = (expectedGoogleServiceAccount) => {
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

// Gen3/CRDC

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

// Anvil

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

// Kids First

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

// BDC

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

// HCA

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

const hcaDosMarthaResult = (expectedGoogleServiceAccount) => {
    return {
        contentType: 'application/octet-stream',
        size: 8933233597,
        timeCreated: null,
        timeUpdated: null,
        bucket: "org-hca-dss-checkout-prod",
        name: "blobs/44d320c9606e32d6df04d8a4023e6474efaa2f99de436e07f7241942972d5703.c3349268e528c844c528a427aa13034e72b7b39d.16c68f2306435b7cf990153b37adeb20-134.64d51664",
        gsUri: "gs://org-hca-dss-checkout-prod/blobs/44d320c9606e32d6df04d8a4023e6474efaa2f99de436e07f7241942972d5703.c3349268e528c844c528a427aa13034e72b7b39d.16c68f2306435b7cf990153b37adeb20-134.64d51664",
        googleServiceAccount: expectedGoogleServiceAccount,
        hashes: {
            sha256: '44d320c9606e32d6df04d8a4023e6474efaa2f99de436e07f7241942972d5703'
        }
    };
};

module.exports = {
    expectedObjWithMissingFields,
    dosObjectWithMissingFields,
    sampleDosResponse,
    jadeDrsResponse,
    hcaDosMarthaResult,
    hcaDosResponse,
    bdcDrsMarthaResult,
    bdcDrsResponse,
    kidsFirstDrsResponse,
    anvilDrsMarthaResult,
    anvilDrsResponse,
    gen3CrdcDrsMarthaResult,
    gen3CrdcResponse,
    sampleDosMarthaResult,
    jadeDrsMarthaResult,
    kidsFirstDrsMarthaResult
};
