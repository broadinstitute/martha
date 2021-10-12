const MARTHA_V3_CORE_FIELDS = [
    'gsUri',
    'bucket',
    'name',
    'fileName',
    'contentType',
    'size',
    'hashes',
    'timeCreated',
    'timeUpdated',
];

// All fields that can be returned in the martha_v3 response.
const MARTHA_V3_ALL_FIELDS = [
    ...MARTHA_V3_CORE_FIELDS,
    'googleServiceAccount',
    'bondProvider',
    'accessUrl',
];

const MARTHA_V3_DEFAULT_FIELDS = [
    ...MARTHA_V3_CORE_FIELDS,
    'googleServiceAccount',
];

// Response fields dependent on the DOS or DRS servers
const MARTHA_V3_METADATA_FIELDS = [
    ...MARTHA_V3_CORE_FIELDS,
    'accessUrl',
];

// Response fields dependent on the Bond service account
const MARTHA_V3_BOND_SA_FIELDS = [
    'googleServiceAccount',
];

// Response fields dependent on the the access_id
const MARTHA_V3_ACCESS_ID_FIELDS = [
    'accessUrl',
];

/**
 * Used to check if any of the requested fields overlap with fields dependent on an underlying service.
 *
 * @param {string[]} requestedFields
 * @param {string[]} serviceFields
 * @returns {boolean} true if the requested fields overlap
 */
function overlapFields(requestedFields, serviceFields) {
    // via https://medium.com/@alvaro.saburido/set-theory-for-arrays-in-es6-eb2f20a61848
    return requestedFields.filter((field) => serviceFields.includes(field)).length !== 0;
}

exports.MARTHA_V3_ALL_FIELDS = MARTHA_V3_ALL_FIELDS;
exports.MARTHA_V3_DEFAULT_FIELDS = MARTHA_V3_DEFAULT_FIELDS;
exports.MARTHA_V3_ACCESS_ID_FIELDS = MARTHA_V3_ACCESS_ID_FIELDS;
exports.MARTHA_V3_METADATA_FIELDS = MARTHA_V3_METADATA_FIELDS;
exports.MARTHA_V3_BOND_SA_FIELDS = MARTHA_V3_BOND_SA_FIELDS;
exports.overlapFields = overlapFields;
