Martha
=========

![alt text](https://raw.githubusercontent.com/broadinstitute/martha/dev/images/doctor_martha_jones_and_the_tardis.jpg)

Google Cloud Functions for resolving [DOS](https://data-object-service.readthedocs.io/en/latest/) URIs.

# Martha v1
Removed as of March 2020. Please use Martha v2.

# Martha v2
To call `martha_v2`, perform an HTTP `POST` to the appropriate URL. The `content-type` of your request should be either
`application/json` or `application/x-www-form-urlencoded` with the content/body of your request encoded accordingly.

The body of the request must be a JSON Object with one value:
a [DOS](https://data-object-service.readthedocs.io/en/latest/) URL. You may also specify an `Authorization` header on
the request with a valid OAuth bearer token. Martha uses the DOS URL to retrieve a data object, unpacks it, and returns
a JSON Object containing one or two values: the list of URIs where the underlying resource may be accessed, and
(optionally) the private key information for the
[Google Service Account](https://cloud.google.com/iam/docs/understanding-service-accounts) that you may use to access
the underlying resource. The Google Service Account information will only be included in the response if you provided an
`Authorization` header on your request.

Staging: https://us-central1-broad-dsde-staging.cloudfunctions.net/martha_v2
Production: https://us-central1-broad-dsde-prod.cloudfunctions.net/martha_v2

# Martha v3
To call `martha_v3`, perform an HTTP `POST` to the appropriate URL. The `content-type` of your request should be either
`application/json` or `application/x-www-form-urlencoded` with the content/body of your request encoded accordingly.

The body of the request must be a JSON object with at least one value:
a [DOS](https://data-object-service.readthedocs.io/en/latest/) or [DRS](https://ga4gh.github.io/data-repository-service-schemas/docs) URL. You must also specify an `Authorization` header on
the request with a valid OAuth bearer token. Martha uses the URL to retrieve a data object, unpacks it, and returns
a standard JSON Object containing the object metadata and (optionally) the private key information for the
[Google Service Account](https://cloud.google.com/iam/docs/understanding-service-accounts) that you may use to access
the underlying resource. The Google Service Account information will only be included in the response if the URL
should return the service account from the account linking service [Bond](https://github.com/DataBiosphere/bond#readme).

Staging: https://us-central1-broad-dsde-staging.cloudfunctions.net/martha_v3
Production: https://us-central1-broad-dsde-prod.cloudfunctions.net/martha_v3

It will return an object with the properties:

```
 contentType:           string [resolver sometimes returns null],
 size:                  int [resolver sometimes returns null],
 timeCreated:           string [the time created formatted using ISO 8601, resolver sometimes returns null],
 timeUpdated:           string [the time updated formatted using ISO 8601, resolver sometimes returns null],
 bucket:                string [resolver sometimes returns null],
 name:                  string [resolver sometimes returns null],
 gsUri:                 string [resolver sometimes returns null],
 googleServiceAccount:  object [null unless the DOS url belongs to a Bond supported host],
 fileName:              string [resolver sometimes returns null],
 accessUrl:             object [resolver sometimes returns null],
 hashes:                object [contains the hashes type and their checksum value; if unknown, it returns null]
```

Example response for /martha_v3:

```
{
    "contentType": "application/octet-stream",
    "size": 156018255,
    "timeCreated": "2020-04-27T15:56:09.696Z",
    "timeUpdated": "2020-04-27T15:56:09.696Z",
    "bucket": "my-bucket",
    "name": "dd3c716a-852f-4d74-9073-9920e835ec8a/f3b148ac-1802-4acc-a0b9-610ea266fb61",
    "gsUri": "gs://my-bucket/dd3c716a-852f-4d74-9073-9920e835ec8a/f3b148ac-1802-4acc-a0b9-610ea266fb61",
    "googleServiceAccount": null,
    "fileName": "hello.txt",
    "accessUrl": {
      "url": "https://storage.example.com/f3b148ac-1802-4acc-a0b9-610ea266fb61?sig=ABC",
      "headers": {
        "Authorization": "Basic Z2E0Z2g6ZHJz"
      }
    },
    "hashes": {
        "md5": "336ea55913bc261b72875bd259753046",
        "sha256": "f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44",
        "crc32c": "8a366443"
    }
}
```

The fields are:
- `gsUri`: The full Google Cloud Storage URI/URL/path to the blob storing the data
- `bucket`: The [bucket name](https://cloud.google.com/storage/docs/key-terms#bucket-names) part of the `gsUri`
- `name`: The [object name](https://cloud.google.com/storage/docs/key-terms#object-names) part of the `gsUri`
- `fileName`: The file name for the bytes
- `contentType`: The type of data stored in the bytes
- `size`: The size of the bytes
- `accessUrl`: The url and optional headers to fetch the bytes
- `hashes`: The various hash types and values for the bytes
- `timeCreated`: The time of creation for the bytes
- `timeUpdated`: The time of last update for the bytes
- `googleServiceAccount`: An optional service account that should be used to access the `gsUri`
- `bondProvider`: An optional Bond provider that may be used to retrieve credentials to access the bytes

The body of the request JSON object may also contain a key named `fields` with a value of an array of strings. The
response will only contain the fields listed in the array. The array should only contain field names from the above
list.

Example request to return the default fields:
```
curl \
    localhost:8010/martha_v3 \
    --header 'Authorization: Bearer <token>' \
    --header 'Content-Type: application/json' \
    --data '{"url": "dos://foo/bar"}'
```

Example request to return only `hashes`, `size`, and `bondProvider`:
```
curl \
    localhost:8010/martha_v3 \
    --header 'Authorization: Bearer <token>' \
    --header 'Content-Type: application/json' \
    --data '{"url": "dos://foo/bar", "fields": ["hashes", "size", "bondProvider"]}'
```

The body of the request JSON object may also contain a key named `googleBillingProject` with a string value. When
the `googleBillingProject` is provided the `accessUrl` will be checked to see if it is a Google Cloud Storage signed
HTTPS URL that requires requester pays. If that check determines that requester pays is required `martha_v3` will
append `&userProject=${googleBillingProject}` to the URL in `accessUrl`.

Example request requesting the `accessUrl` be checked for requester pays:
```
curl \
    localhost:8010/martha_v3 \
    --header 'Authorization: Bearer <token>' \
    --header 'Content-Type: application/json' \
    --data '
    {
      "url": "dos://foo/bar",
      "googleBillingProject": "some-billing-project",
      "fields": ["accessUrl"]
    }'
```

**NOTE:**

There was an [early substitution recommendation to
users](https://app.zenhub.com/workspaces/orange-5d680d7e3eeb5f1bbdf5668f/issues/databiosphere/azul/1115), instructing
them to convert their URL schemes from "dos" to "drs". Some underlying servers hosting the DOS/DRS metadata have not yet
upgraded to support the DRS request path-prefix and DRS response JSON metadata, so `martha_v2` and `martha_v3` still 
communicate with those servers using the older request/response format.

At the same time, those server hosts are also working to submit test accounts for automated testing purposes. The final
list of supported `martha_v3` servers is still being finalized while those test accounts are being created.

Martha's `martha_v3` implementation translates requests-to and responses-from the following hosts:

- ✅ [Jade Data Repo](https://github.com/DataBiosphere/jade-data-repo#readme) (JDR)
    - Prod host: `data.terra.bio`
    - Dev host: `jade.datarepo-dev.broadinstitute.org`
    - Martha Testing: 🤖 Continuous Automated
    - Returns Bond SA: No
    - Requires OAuth for metadata: 🔐 Yes
    - Example: `drs://jade.datarepo-dev.broadinstitute.org/v1_0c86170e-312d-4b39-a0a4-2a2bfaa24c7a_c0e40912-8b14-43f6-9a2f-b278144d0060`
- ❌ [DataGuids.org](https://dataguids.org/)
    (any drs://dg.* other than drs://dg.4503, drs://dg.712C, drs://dg.ANV0, drs://dg.4DFC, drs://dg.F82A1A,
     and not drs://dataguids.org)
    - Prod host: `gen3.biodatacatalyst.nhlbi.nih.gov`
    - Dev host: `staging.gen3.biodatacatalyst.nhlbi.nih.gov`
    - Martha testing: 🖐 Manual (in production)
    - Returns Bond SA: Yes, Bond provider `dcf-fence`
    - Requires OAuth for metadata: 🔓 No
    - Example: _unknown_
- ❌ [DataGuids.org](https://dataguids.org/) (drs://dg.4503 in prod and drs://dg.712C in non-prod)
    - Prod host: `gen3.biodatacatalyst.nhlbi.nih.gov`
    - Dev host: `staging.gen3.biodatacatalyst.nhlbi.nih.gov`
    - Martha testing: 🖐 Manual
    - Returns Bond SA: Yes, Bond provider `fence`
    - Requires OAuth for metadata: 🔓 No
    - Example: `drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0`
- ❌ The [Analysis, Visualization and Informatics Lab-space](https://www.genome.gov/Funded-Programs-Projects/Computational-Genomics-and-Data-Science-Program/Genomic-Analysis-Visualization-Informatics-Lab-space-AnVIL)
    (The AnVIL, dg.ANV0)
    - Prod host: `gen3.theanvil.io`
    - Dev host: `staging.theanvil.io`
    - Martha testing: 🚫 Mock only
    - Returns Bond SA: Yes, Bond provider `anvil`
    - Requires OAuth for metadata: 🔓 No
    - Example: `drs://dg.ANV0/00008531-03d7-418c-b3d3-b7b22b5381a0`
- ❌ [DataGuids.org](https://dataguids.org/) (drs://dataguids.org, but not drs://dg.*)
    - Prod host: `dataguids.org`
    - Dev host: _unknown_
    - Martha testing: 🚫 Mock only
    - Returns Bond SA: Yes, Bond provider `dcf-fence`
    - Requires OAuth for metadata: 🔓 No
    - Example: `dos://dataguids.org/a41b0c4f-ebfb-4277-a941-507340dea85d`
- ❌ [UCSC Single Cell Dev Server](https://drs.dev.singlecell.gi.ucsc.edu/)
    - Prod host: _unknown_
    - Dev host: `drs.dev.singlecell.gi.ucsc.edu`
    - Martha testing: 🚫 Mock only
    - Returns Bond SA: Yes, Bond provider `dcf-fence`
    - Requires OAuth for metadata: 🔐 Yes
    - Example:
    `drs://drs.dev.singlecell.gi.ucsc.edu/bee7a822-ea28-4374-8e18-8b9941392723?version=2019-05-15T205839.080730Z`
- ❌ [Gabriella Miller Kids First Pediatric Data Resource](https://commonfund.nih.gov/kidsfirst/overview)
    (drs://dg.F82A1A)
    - Prod host: `data.kidsfirstdrc.org`
    - Dev host: `gen3staging.kidsfirstdrc.org`
    - Martha testing: 🚫 Mock only
    - Returns Bond SA: Yes, Bond provider `kids-first`
    - Requires OAuth for metadata: 🔓 No
    - Example: `drs://data.kidsfirstdrc.org/ed6be7ab-068e-46c8-824a-f39cfbb885cc`
- ❌ [Cancer Research Data Commons](https://datacommons.cancer.gov/) (CRDC, drs://dg.4DFC)
    - Prod host: `nci-crdc.datacommons.io`
    - Dev host: `nci-crdc-staging.datacommons.io`
    - Martha testing: 🚫 Mock only
    - Returns Bond SA: Yes, Bond provider `dcf-fence`
    - Requires OAuth for metadata: 🔓 No
    - Example: `drs://nci-crdc.datacommons.io/0027045b-9ed6-45af-a68e-f55037b5184c`

<sup>
✅ = DRS v1.0 hosts tested with Martha's `martha_v3` endpoint<br/>
❌ = Hosts that either a) don't support DRS v1.0, or b) haven't been tested with Martha's `martha_v3` endpoint
</sup>

Other DRS servers might work with Martha's `martha_v3` endpoint, however only the servers above are officially
supported. For more information see these documents:

- [Mapping Data GUIDs to DRS Server
    Hostnames](https://docs.google.com/document/d/1Sp-FS9v8wIi-85knvrJqrunxq7b_24phu_MFHtdQZB8/edit)
- [DRS 1.1 Transition within
    NCPI](https://docs.google.com/document/d/1Wf4enSGOEXD5_AE-uzLoYqjIp5MnePbZ6kYTVFp1WoM/edit)
- [Getting Through the DRS 1.1 Compact Identifier Transition for
    Gen3/Terra](https://docs.google.com/document/d/1Sw-XZvIbxjG2w2UYdLwCN7TJ4raKhYLzRrveWaYguGM/edit)

If you have an additional server you'd like to add to Martha, please store the test credentials in Vault and submit a PR
with both the integration test and updated documentation. If you do not have direct access to Vault, please contact us
via [Jira](https://broadworkbench.atlassian.net/projects/BT/issues) to have your test credentials stored. NOTE: You will
need to create a free account to access the Jira board.

# File Summary v1
The file summary service will return metadata and a signed download URL good for one hour (in the case of a DOS URI,
only if the caller is linked in Bond).

It expects the following:

* an `Authorization` header containing a bearer token
* `Content-Type: application/json`
* an object containing the key `uri`

It will always return an object with the same properties:

```
 contentType:           string,
 size:                  int,
 timeCreated:           string by design [resolver sometimes returns null],
 updated:               string by design [resolver sometimes returns null],
 md5Hash:               string,
 bucket:                string,
 name:                  string,
 gsUri:                 string,
 googleServiceAccount:  string [always null],
 signedUrl:             string [absent for dos when caller is not linked in Bond]
```

# Get Signed Url
Requires a bearer token in the `authorization` header.

Expects JSON with the keys `bucket`, `object`, and optionally `dataObjectUri`.  
Returns JSON with the key `url`.

If present, `dataObjectUri` is used to determine a provider for Bond. Otherwise, a standard pet service account from Sam 
is used.

# Development
## Setup
* Install Node 12, the current LTS
  * Google Cloud Functions (GCF) follow Node LTS releases as described
  [here](https://cloud.google.com/functions/docs/writing/#the_cloud_functions_runtime).
  * **MacOS** - It is recommended that you install Node using [Homebrew](https://brew.sh/), or a version manager like
  [nodenv](https://github.com/nodenv/nodenv) or [nvm](https://github.com/creationix/nvm).
* Clone the Martha git repository and `cd` to it
* Make sure your version of npm is up-to-date: `npm install -g npm`
* Install dependencies: `npm install`

## ESLint 
ESLint is a tool for identifying and reporting on patterns found in ECMAScript/JavaScript code, with the goal of making code more consistent and avoiding bugs.
More information can be found on it's [website](https://eslint.org/).

### Installation and Usage
Prerequisites: Node.js (>=12.x) built with SSL support
* Install ESLint using npm or yarn:
  `npm install eslint --save-dev`
  or
  `yarn add eslint --dev`
* One can setup their own configuration file using `npx eslint --init` (and prompts followed) or use the `.eslintrc.js` file 
found at root of this project
* Run ESLint on any specific file or directory `npx eslint <file_name or directory_name>`. To run ESLint from the root of the project
use `npx eslint .`
  
### Fix Automatically
Many problems ESLint finds can be automatically fixed. When ESLint is run on file or directory, at the end it states how many errors or warning can be 
fixed automatically. `--fix` option on the command line can be used for this. 

Run the `npx` command using `--fix` flag: `npx eslint <file_name/directory_name> --fix`

## Google Cloud Functions (GCF) Framework
* The Martha functions may be run locally via the
[functions-framework](https://github.com/GoogleCloudPlatform/functions-framework-nodejs), started with following command
  * `npm start`
* From another terminal, test the function:
    ```
    curl \
        localhost:8010/martha_v3 \
        --header 'Authorization: Bearer <token>' \
        --header 'Content-Type: application/json' \
        --data '{"url": "dos://foo/bar"}'
    ```
* To stop the functions-framework press `Control-C` in the terminal running `npm start`.

## Run Tests

`npm test`

## Run Integration Tests

Prerequisites:
- Access to Vault for retrieving integration test credentials
- A checkout of [Bond](https://github.com/databiosphere/bond) to run Bond locally on `127.0.0.1:8080`
- Python virtual environments to run parts of Bond in Python 2 and Python 3:
  - [Recommendations from Bond](https://github.com/databiosphere/bond#virtualenv)
  - [Conda](https://docs.conda.io/)
  - [virtualenvwrapper](https://virtualenvwrapper.readthedocs.io)
  - etc.

Setup:
- From your martha directory render the credentials for Martha's integration tests
```
docker \
  run \
  --rm \
  --volume "$PWD:$PWD" \
  --env INPUT_PATH="$PWD/automation" \
  --env OUT_PATH="$PWD/automation" \
  --env ENVIRONMENT=dev \
  --env VAULT_TOKEN="$(cat ~/.vault-token)" \
  broadinstitute/dsde-toolbox \
  render-templates.sh
```
- Follow the steps referenced in ["Bond: Run
  locally"](https://github.com/DataBiosphere/bond#run-locally) to start a local Bond server on `127.0.0.1:8080`
  - Ensure you have rendered the Bond configs
  - You be running two virtual environment sessions for Bond, one with Python 2 and one Python 3

Running the Integration Tests:
- After finishing your setup, start your martha emulator in a separate terminal
  - Start Martha using `ENV=mock npm start`. This will start the functions-framework to listen for requests on port 8010.
  - Console logs will print to the terminal
  - Whenever you make changes you will need to kill and restart Martha
  - Stop Martha using Control-C
- In a separate terminal window, run Martha's integration tests via:
  - `ENV=mock npm run integration`

## Deployment and Releasing

* Deployments to the `cromwell-dev` tier are triggered manually by running `./deploy-cromwell-dev.sh`. The script will
build a docker image using your current working directory and current git branch name, and then deploy the resulting
code to `broad-dsde-cromwell-dev`. There you can test out changes before submitting pull requests.
`broad-dsde-cromwell-dev` is an environment administered by the DSP-Batch team, who previously worked primarily on
Cromwell development and now also maintains Martha.

* Deployments to the `dev` tier are triggered automatically whenever code is pushed/merged to the `dev` branch on github.

* When the latest code passes tests in CircleCI, it is tagged `dev_tests_passed_[timestamp]` where `[timestamp]` is the epoch time when the tag was created.

* [Terra-specific release checklist](docs/release-checklist.md)


**NOTE:** 
* Each deployment will redeploy all supported versions of functions.
* It is important that you deploy to all tiers.  Because Martha is an "indie service", we should strive to make sure
that all tiers other than `cromwell-dev` and `dev` are kept in sync and are running the same versions of code.  This is
essential so that, as other DSP services are tested during their release process, they can ensure that their code will
work properly with the latest version of Martha running in `prod`.

## Docker

The Dockerfile for Martha builds a Docker image that, when run, does the following:

* Starts the [Google Cloud Functions Framework](https://cloud.google.com/functions/docs/functions-framework)
* Serves all supported Martha functions via the functions-framework
* Exposes port `8010` (the port previously used by the
[functions-emulator](https://github.com/googlearchive/cloud-functions-emulator/wiki/Calling-functions#calling-http-functions))
* Handles `HTTP` requests to functions served over the exposed port

## Run the Docker Container

To run the Martha container, whether running a locally built image or an image pulled from a repository, you must
start the container with appropriate port mapping between the host and the container.  You can choose whatever host
port you may require; in the following example port `58010` is used:

`docker run --publish 58010:8010 us.gcr.io/broad-dsp-gcr-public/martha:latest`

## Building Docker Images

Public images are published to Google Container Registry (GCR) for each branch.

To list images run:

```bash
gcloud container images list-tags us.gcr.io/broad-dsp-gcr-public/martha
```

To build a new Docker image for Martha:

1. `cd` to the root of the Martha codebase
1. Run: `docker build -f docker/Dockerfile .`


## Logs (for live app)
* Can be viewed on Google Cloud Platform
  * Go to [console.cloud.google.com](https://console.cloud.google.com/)
  * Select Cloud Functions from the main (on the left side) menu
  * Find the version of the function you want to check
  * Click the vertical three dots and choose "view logs"
