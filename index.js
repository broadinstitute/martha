/**
 * Google Cloud Function for GUID resolution
 * written by Ursa S 02/18
 */

const corsMiddleware = require('cors')();
const axios = require('axios').default;
const {drshubUrl} = require("./common/config");

const addSecurityHeaders = (res) => {
    res.set({
        'Strict-Transport-Security': 'max-age=63072000',
        'Cache-Control': 'no-store',
    });
};

function sendDrsHubRequest(req, res, url) {
    return axios.post(url, req.body, {
        headers: {
            "authorization": req.headers.authorization,
            "Content-Type": "application/json",
        }
    })
        .then((response) => {
            return res.status(response.status).send(response.data);
        })
        .catch((error) => {
            console.log(error.response.data);
            return res.status(error.response.status).send(error.response.data);
        });
}

exports.martha_v2 = (req, res) => {
    res.status(299).send(`You are attempting to use a deprecated API, please switch to using ${drshubUrl}.`);
};

exports.fileSummaryV1 = (req, res) => {
    res.status(299).send(`You are attempting to use a deprecated API, please switch to using ${drshubUrl}.`);
};

exports.martha_v3 = (req, res) => {
    addSecurityHeaders(res);
    corsMiddleware(req, res, () => {
        const url=`${drshubUrl}/api/v4/drs/resolve`;
        return sendDrsHubRequest(req, res, url);
    });
};

exports.getSignedUrlV1 = (req, res) => {
    addSecurityHeaders(res);
    corsMiddleware(req, res, () => {
        const url=`${drshubUrl}/api/v4/gcs/getSignedUrl`;
        return sendDrsHubRequest(req, res, url);
    });
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
