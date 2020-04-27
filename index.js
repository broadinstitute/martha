/**
 * Google Cloud Function for GUID resolution
 * written by Ursa S 02/18
 */

const corsMiddleware = require('cors')();
const { marthaV2Handler } = require('./martha/martha_v2');
const { fileSummaryV1Handler } = require('./fileSummaryV1/fileSummaryV1');
const getSignedUrlV1 = require('./handlers/getSignedUrlV1');

exports.martha_v2 = (req, res) => {
    corsMiddleware(req, res, () => marthaV2Handler(req, res));
};

exports.fileSummaryV1 = (req, res) => {
    corsMiddleware(req, res, () => fileSummaryV1Handler(req, res));
};

exports.getSignedUrlV1 = (req, res) => {
    corsMiddleware(req, res, () => getSignedUrlV1(req, res));
};
