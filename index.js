/**
 * Google Cloud Function for GUID resolution
 * written by Ursa S 02/18
 */

const corsMiddleware = require('cors')();
const { martha_v1_handler } = require('./martha_v1');
const { martha_v2_handler } = require('./martha_v2');
const { martha_v3_handler } = require('./martha_v3');

exports.martha_v1 = (req, res) => {
    corsMiddleware(req, res, () => martha_v1_handler(req, res));
};

exports.martha_v2 = (req, res) => {
    corsMiddleware(req, res, () => martha_v2_handler(req, res));
};

exports.martha_v3 = (req, res) => {
    corsMiddleware(req, res, () => martha_v3_handler(req, res));
};
