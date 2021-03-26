const test = require('ava');
const sinon = require('sinon');
const {
    dataObjectUriToHttps,
    jadeDataRepoHostRegex,
    samBaseUrl,
    getHashesMap,
    convertToMarthaV3Response,
    MarthaV3Response,
    FailureResponse,
    logAndSendBadRequest,
    logAndSendServerError,
} = require('../../common/helpers');
const config = require('../../common/config');

const mockResponse = () => {
    const res = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

/**
 *Begin Scenario 1: data objects uri with non-dg host and path
 */
test('dataObjectUriToHttps should parse dos:// Data Object uri', (t) => {
    t.is(dataObjectUriToHttps('dos://foo/bar'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('dataObjectUriToHttps should parse dos:// Data Object uri and preserve case', (t) => {
    t.is(dataObjectUriToHttps('dos://FoO/BAR'), 'https://FoO/ga4gh/dos/v1/dataobjects/BAR');
});

test('dataObjectUriToHttps should parse drs:// Data Object uri', (t) => {
    t.is(dataObjectUriToHttps('drs://foo/bar'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('dataObjectUriToHttps should parse drs:// Data Object uri with "/" path', (t) => {
    t.is(dataObjectUriToHttps('drs://foo/bar/'), 'https://foo/ga4gh/dos/v1/dataobjects/bar');
});

test('dataObjectUriToHttps should parse drs:// Data Object uri with query part', (t) => {
    t.is(dataObjectUriToHttps('drs://foo/bar?version=1&bananas=yummy'), 'https://foo/ga4gh/dos/v1/dataobjects/bar?version=1&bananas=yummy');
});

test('dataObjectUriToHttps should parse drs:// Data Object uri when host includes a port number', (t) => {
    t.is(dataObjectUriToHttps('drs://foo.com:1234/bar'), 'https://foo.com:1234/ga4gh/dos/v1/dataobjects/bar');
});
/**
 * End Scenario 1
 */

/**
 * Begin Scenario 2: data objects uri with dg host
 */
test('dataObjectUriToHttps should parse "dos://dg." Data Object uri to use bioDataCatalystHost', (t) => {
    t.is(dataObjectUriToHttps('dos://dg.2345/bar'), `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('dataObjectUriToHttps should parse "dos://dg." Data Object uri to use bioDataCatalystHost and preserve case', (t) => {
    t.is(dataObjectUriToHttps('dos://dg.2345AbCdE/bAr'), `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/dg.2345AbCdE/bAr`);
});

test('dataObjectUriToHttps should parse "drs://dg." Data Object uri to use bioDataCatalystHost', (t) => {
    t.is(dataObjectUriToHttps('drs://dg.2345/bar'), `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('dataObjectUriToHttps should parse "drs://dg." Data Object uri with "/" path to use bioDataCatalystHost', (t) => {
    t.is(dataObjectUriToHttps('drs://dg.2345/bar/'), `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/dg.2345/bar`);
});

test('dataObjectUriToHttps should parse "drs://dg." Data Object uri with query part to use bioDataCatalystHost', (t) => {
    t.is(dataObjectUriToHttps('drs://dg.2345/bar?version=1&bananas=yummy'), `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/dg.2345/bar?version=1&bananas=yummy`);
});

test('dataObjectUriToHttps should throw an error when given a "dg.*" host with no path', (t) => {
    t.throws(
        () => dataObjectUriToHttps('dos://dg.4503'),
        {
            instanceOf: Error,
            message: `Data Object URIs with either 'dg.*' or '${jadeDataRepoHostRegex}' as host are required to have a path: "dos://dg.4503"`
        },
        'Should have thrown error but didnt!'
    );
});

/**
 * End Scenario 2
 */

/**
 * Begin Scenario 3: data objects uri with non-dg host and NO path
 */
test('should parse "dos://dg." Data Object uri with only a host part without a path', (t) => {
    t.is(dataObjectUriToHttps('dos://foo-bar-baz'), `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/foo-bar-baz`);
});

test('should parse "drs://dg." Data Object uri with only a host part without a path', (t) => {
    t.is(dataObjectUriToHttps('drs://foo-bar-baz'), `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/foo-bar-baz`);
});

test('should parse "drs://dg." Data Object uri with only a host part with a "/" path', (t) => {
    t.is(dataObjectUriToHttps('drs://foo-bar-baz/'), `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/foo-bar-baz`);
});

test('should parse "drs://dg." Data Object uri with only a host part with a query part', (t) => {
    t.is(dataObjectUriToHttps('drs://foo-bar-baz?version=1&bananas=yummy'), `https://${config.HOST_BIODATA_CATALYST_STAGING}/ga4gh/dos/v1/dataobjects/foo-bar-baz?version=1&bananas=yummy`);
});
/**
 * End Scenario 3
 */

/**
 * Begin Scenario 4: data objects uri with jade data repo host
 */
test('should parse Data Object uri with jade data repo DEV as host', (t) => {
    t.is(
        dataObjectUriToHttps('drs://jade.datarepo-dev.broadinstitute.org/973b5e79-6433-40ce-bf38-686ab7f17820'),
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test('should parse Data Object uri with jade data repo DEV as host and path with snapshot id', (t) => {
    t.is(
        dataObjectUriToHttps('drs://jade.datarepo-dev.broadinstitute.org/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'),
        'https://jade.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_c78919df-5d71-414b-ad29-7c3c0d810657_973b5e79-6433-40ce-bf38-686ab7f17820'
    );
});

test('should parse Data Object uri with jade data repo PROD as host', (t) => {
    t.is(
        dataObjectUriToHttps('drs://data.terra.bio/anything'),
        'https://data.terra.bio/ga4gh/drs/v1/objects/anything'
    );
});

test('should throw error when given jade data repo host and no path', (t) => {
    t.throws(
        () => dataObjectUriToHttps('drs://jade.datarepo-dev.broadinstitute.org/'),
        {
            instanceOf: Error,
            message: `Data Object URIs with either 'dg.*' or '${jadeDataRepoHostRegex}' as host are required to have a path: "drs://jade.datarepo-dev.broadinstitute.org"`
        },
        'Should have thrown error but didnt!'
    );
});

test('should parse Data Object uri with host that looks like jade data repo host', (t) => {
    t.is(
        dataObjectUriToHttps('drs://jade-data-repo.datarepo-dev.broadinstitute.org/v1_anything'),
        'https://jade-data-repo.datarepo-dev.broadinstitute.org/ga4gh/drs/v1/objects/v1_anything'
    );
});
/**
 * End Scenario 4
 */

test('dataObjectUriToHttps should throw a Error when passed an invalid uri', (t) => {
    t.throws(
        () => dataObjectUriToHttps('A string that is not a valid URI'),
        {
            instanceOf: Error,
            message: 'Cannot read property \'0\' of null'
        },
        'Should have thrown error but didnt!'
    );
});

test('samBaseUrl should come from the config json', (t) => {
    t.is(samBaseUrl(), config.samBaseUrl);
});

/**
 * Test the getHashesMap() function
 */

test('getHashesMap should return null for empty checksums array', (t) => {
    t.deepEqual(getHashesMap([]), null);
});

test('getHashesMap should return map with 1 entry for checksums array with 1 element', (t) => {
    const checksumArray = [
        {
            type: 'md5',
            checksum: '336ea55913bc261b72875bd259753046'
        }
    ];
    const expectedChecksumMap = {
        md5: '336ea55913bc261b72875bd259753046'
    };

    t.deepEqual(getHashesMap(checksumArray), expectedChecksumMap);
});

test('getHashesMap should return map with multiple hashes for checksums array', (t) => {
    const checksumArray = [
        {
            type: 'md5',
            checksum: '336ea55913bc261b72875bd259753046'
        },
        {
            type: 'sha256',
            checksum: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44'
        },
        {
            type: 'crc32c',
            checksum: '8a366443'
        },
    ];
    const expectedChecksumMap = {
        md5: '336ea55913bc261b72875bd259753046',
        sha256: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44',
        crc32c: '8a366443'
    };

    t.deepEqual(getHashesMap(checksumArray), expectedChecksumMap);
});

test('getHashesMap should throw error if the checksums array contains duplicate `checksum` values for same `type`', (t) => {
    const checksumArray = [
        {
            type: 'md5',
            checksum: '336ea55913bc261b72875bd259753046'
        },
        {
            type: 'sha256',
            checksum: 'f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44'
        },
        {
            type: 'md5',
            checksum: 'a06d435b61a55eb5c0f712c1d88ac782'
        },
    ];

    t.throws(
        () => getHashesMap(checksumArray),
        {
            instanceOf: Error,
            message: 'Response from DRS Resolution server contained duplicate checksum values for hash type \'md5\' in checksums array!'
        },
        'Should have throw error but didnt!'
    );
});

/**
 * Test the convertToMarthaV3Response() function
 */
test('convertToMarthaV3Response should return null for all fields in an unlikely event of empty drs and bond responses', (t) => {
    const expectedResponse = new MarthaV3Response(
        'application/octet-stream',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null
    );
    t.deepEqual(convertToMarthaV3Response({}, null, {}), expectedResponse);
});

test('convertToMarthaV3Response should return null for fields that are missing in drs response', (t) => {
    const mockDrsResponse = {
        id: 'v1_abc-123',
        description: '123 BAM file',
        name: '123.mapped.abc.bam',
        created_time: '2020-04-27T15:56:09.696Z',
        version: '0',
        mime_type: 'application/octet-stream',
        size: 123456
    };
    const expectedResponse = new MarthaV3Response(
        'application/octet-stream',
        123456,
        '2020-04-27T15:56:09.696Z',
        null,
        null,
        null,
        null,
        null,
        null,
        '123.mapped.abc.bam',
        null
    );

    t.deepEqual(convertToMarthaV3Response(mockDrsResponse, null, {}), expectedResponse);
});

test('convertToMarthaV3Response should return null for fields that are empty in drs with empty bond responses', (t) => {
    const mockDrsResponse = {
        id: 'v1_abc-123',
        description: '123 BAM file',
        name: '123.mapped.abc.bam',
        version: '0',
        mime_type: 'application/octet-stream',
        size: 123456,
        created_time: '2020-04-27T15:56:09.696Z',
        updated_time: '2020-04-27T15:56:09.696Z',
        checksums: [],
        access_methods: []
    };
    const expectedResponse = new MarthaV3Response(
        'application/octet-stream',
        123456,
        '2020-04-27T15:56:09.696Z',
        '2020-04-27T15:56:09.696Z',
        null,
        null,
        null,
        null,
        null,
        '123.mapped.abc.bam',
        null
    );

    t.deepEqual(convertToMarthaV3Response(mockDrsResponse, null, {}), expectedResponse);
});

test('convertToMarthaV3Response should return null for googleServiceAccount if bond returned nothing', (t) => {
    const mockDrsResponse = {
        id: 'v1_abc-123',
        description: '123 BAM file',
        name: '123.mapped.abc.bam',
        version: '0',
        mime_type: 'application/octet-stream',
        size: 123456,
        created_time: '2020-04-27T15:56:09.696Z',
        updated_time: '2020-04-27T15:56:09.696Z',
        checksums: [
            {
                type: 'md5',
                checksum: '123abc'
            }
        ],
        access_methods: [
            {
                type: 'gs',
                access_url: {
                    url:
                        'gs://abc/123',
                }
            }
        ]
    };
    const expectedResponse = new MarthaV3Response(
        'application/octet-stream',
        123456,
        '2020-04-27T15:56:09.696Z',
        '2020-04-27T15:56:09.696Z',
        'abc',
        '123',
        'gs://abc/123',
        null,
        null,
        '123.mapped.abc.bam',
        { md5: '123abc' },
    );

    t.deepEqual(convertToMarthaV3Response(mockDrsResponse), expectedResponse);
});

function testFailureResponse(t, res, expectedStatus, expectedText) {
    t.true(Object.prototype.isPrototypeOf.call(FailureResponse.prototype, res.send.firstCall.firstArg));
    t.is(res.status.firstCall.firstArg, expectedStatus);
    t.is(res.send.firstCall.firstArg.status, expectedStatus);
    t.is(res.send.firstCall.firstArg.response.status, expectedStatus);
    t.is(res.send.firstCall.firstArg.response.text, expectedText);
}

test('helpers logAndSendBadRequest should send failures', (t) => {
    const res = mockResponse();
    const error = new Error('this is a test');
    error.stack = null;
    logAndSendBadRequest(res, error);
    testFailureResponse(t, res, 400, 'Request is invalid. this is a test');
});

test('helpers logAndSendServerError should send a string failure', (t) => {
    const res = mockResponse();
    const error = new Error('this is a test');
    error.stack = null;
    logAndSendServerError(res, error, 'description');
    testFailureResponse(t, res, 500, 'description this is a test');
});

test('helpers logAndSendServerError should send a superagent failure', (t) => {
    const res = mockResponse();
    const superAgentFields = {
        status: 401,
        response: {
            req: {
                method: "GET",
                url: "http://127.0.0.1:8080/api/link/v1/fence/serviceaccount/key",
                headers: {
                    authorization: "foo"
                }
            },
            header: {
                'content-type': 'application/json',
                'content-length': '248',
                'access-control-allow-origin': '*',
                'server': 'Werkzeug/0.16.0 Python/3.8.6',
                'date': 'Thu, 05 Nov 2020 02:00:36 GMT'
            },
            status: 401,
            text:
                '{"error":' +
                '{"code":401,"errors":[' +
                '{' +
                '"domain":"global",' +
                '"message":"Malformed Authorization header, must be in the form of \\"bearer [token]\\".",' +
                '"reason":"required"' +
                '}],' +
                '"message":"Malformed Authorization header, must be in the form of \\"bearer [token]\\"."}}\n'
        }
    };
    const error = new Error("this is a test");
    error.stack = null;
    Object.assign(error, superAgentFields);
    logAndSendServerError(res, error, 'superagent');
    testFailureResponse(
        t,
        res,
        401,
        'superagent Malformed Authorization header, must be in the form of "bearer [token]".',
    );
});

test('helpers logAndSendServerError should send a Bond failure', (t) => {
    const res = mockResponse();
    const bondErrorJson = {
        error: {
            code: 401,
            errors: [
                {
                    domain: 'global',
                    message:
                        'Invalid authorization token. ' +
                        'b\'{\\n  "error": "invalid_token",\\n  "error_description": "Invalid Value"\\n}\\n\'',
                    reason: 'required'
                }
            ],
            message:
                'Invalid authorization token. ' +
                'b\'{\\n  "error": "invalid_token",\\n  "error_description": "Invalid Value"\\n}\\n\''
        }
    };
    const error = new Error(JSON.stringify(bondErrorJson));
    error.stack = null;
    logAndSendServerError(res, error, 'Bond');
    testFailureResponse(
        t,
        res,
        500,
        'Bond Invalid authorization token. ' +
        'b\'{\\n  "error": "invalid_token",\\n  "error_description": "Invalid Value"\\n}\\n\'',
    );
});
