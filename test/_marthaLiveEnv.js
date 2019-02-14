/**
 * This file is named with a leading `_` to prevent Ava from processing this file and looking for tests within it
 * */

const _publicDosUrlsWithGS = [
    'dos://dos-dss.ucsc-cgp-dev.org/00e6cfa9-a183-42f6-bb44-b70347106bbe'
];

const _publicDosUrlsWithoutGS = [
    'dos://qa.dcf.planx-pla.net/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc',
    'dos://nci-crdc-staging.datacommons.io/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc',
    'dos://dataguids.org/206dfaa6-bcf1-4bc9-b2d0-77179f0f48fc'
];

const _publicDosUrls = _publicDosUrlsWithoutGS.concat(_publicDosUrlsWithGS);

const _mockedDosUrlsWithGS = [
    'dos://wb-mock-drs-dev.storage.googleapis.com/0c8e7bc6-fd76-459d-947b-808b0605beb3',
    'dos://wb-mock-drs-dev.storage.googleapis.com/65e4cd14-f549-4a7f-ad0c-d29212ff6e46',
    'dos://wb-mock-drs-dev.storage.googleapis.com/drs.json',
    'dos://wb-mock-drs-dev.storage.googleapis.com/preview_dos.json'
];

const _mockDosUrlsWithoutGS = [
    'dos://wb-mock-drs-dev.storage.googleapis.com/noGSUrl.json'
];

const _mockedDosUrls = _mockedDosUrlsWithGS.concat(_mockDosUrlsWithoutGS);

function marthaLiveEnv(args) {
    const parsedArgs = require('minimist')(args);
    this.env = parsedArgs.e || parsedArgs.env || 'local';
    this.useMockDrs = parsedArgs.m || parsedArgs.mock || false;
    this.baseUrl = parsedArgs.base_url || chooseBaseUrl(this.env);
    this.dosUrls = this.useMockDrs ? _mockedDosUrls : _publicDosUrls;
    this.dosUrlsWithGS = this.useMockDrs ? _mockedDosUrlsWithGS : _publicDosUrlsWithGS;
    this.dosUrlsWithoutGS = this.useMockDrs ? _mockDosUrlsWithoutGS : _publicDosUrlsWithoutGS;
}

function chooseBaseUrl(env) {
    let baseUrl = 'http://localhost:8010/broad-dsde-dev/us-central1';
    if (['dev', 'staging', 'alpha', 'perf', 'prod']) {
        baseUrl = `https://us-central1-broad-dsde-${env}.cloudfunctions.net/`;
    }
    return baseUrl;
}

exports.MarthaLiveEnv = marthaLiveEnv;