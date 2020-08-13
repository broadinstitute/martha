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

// module.exports = {
//     sampleDosResponse, jadeDrsResponse
// };

exports.sampleDosResponse = sampleDosResponse;
exports.jadeDrsResponse = jadeDrsResponse;
