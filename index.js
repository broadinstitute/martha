/**
 * Google Cloud Function for GUID resolution
 * written by Ursa S 02/18
 */

const corsMiddleware = require('cors')();
const { marthaV2Handler } = require('./martha/martha_v2');
const { marthaV3Handler } = require('./martha/martha_v3');
const { fileSummaryV1Handler } = require('./fileSummaryV1/fileSummaryV1');
const getSignedUrlV1 = require('./handlers/getSignedUrlV1');

const addSecurityHeaders = (res) => {
    res.set({
      'Strict-Transport-Security': 'max-age=63072000',
      CacheControl: 'no-store',
    });
}

exports.martha_v2 = (req, res) => {
    addSecurityHeaders(res);
    corsMiddleware(req, res, () => marthaV2Handler(req, res));
};

exports.martha_v3 = (req, res) => {
    addSecurityHeaders(res);
    corsMiddleware(req, res, () => marthaV3Handler(req, res));
};

exports.fileSummaryV1 = (req, res) => {
    addSecurityHeaders(res);
    corsMiddleware(req, res, () => fileSummaryV1Handler(req, res));
};

exports.getSignedUrlV1 = (req, res) => {
    addSecurityHeaders(res);
    corsMiddleware(req, res, () => getSignedUrlV1(req, res));
};

/*
Modified version of: https://github.com/GoogleCloudPlatform/functions-framework-nodejs/issues/23#issuecomment-510704908

The FIABs still use the older "dockerized-martha" paths where the emulator included a gcloud project and zone. The
gcloud project used to be set in the Dockerfile; it's no longer there after the functions-emulator was removed and
replaced with the functions-framework. https://github.com/googlearchive/cloud-functions-emulator/issues/327
 */
exports.index = (req, res) => {
    switch (req.path) {
        case '/martha_v2':
        case '/dockerized-martha/us-central1/martha_v2':
            return exports.martha_v2(req, res);
        case '/martha_v3':
        case '/dockerized-martha/us-central1/martha_v3':
            return exports.martha_v3(req, res);
        case '/fileSummaryV1':
        case '/dockerized-martha/us-central1/fileSummaryV1':
            return exports.fileSummaryV1(req, res);
        case '/getSignedUrlV1':
        case '/dockerized-martha/us-central1/getSignedUrlV1':
            return exports.getSignedUrlV1(req, res);
        default:
            addSecurityHeaders(res);
            res.send('function not defined');
    }
};
