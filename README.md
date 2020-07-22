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
Currently is in development stage. Please do not use it.

To call `martha_v3`, perform an HTTP `POST` to the appropriate URL. The `content-type` of your request should be either
`application/json` or `application/x-www-form-urlencoded` with the content/body of your request encoded accordingly.

The body of the request must be a JSON Object with one value:
a [DOS](https://data-object-service.readthedocs.io/en/latest/) URL. You must also specify an `Authorization` header on
the request with a valid OAuth bearer token. Martha uses the DOS URL to retrieve a data object, unpacks it, and returns
a standard JSON Object containing the object metadata and (optionally) the private key information for the
[Google Service Account](https://cloud.google.com/iam/docs/understanding-service-accounts) that you may use to access
the underlying resource. The Google Service Account information will only be included in the response if the DOS URL
should return the service account from the account linking service [Bond](https://github.com/DataBiosphere/bond#readme).

Staging: https://us-central1-broad-dsde-staging.cloudfunctions.net/martha_v3
Production: https://us-central1-broad-dsde-prod.cloudfunctions.net/martha_v3

It will always return an object with the same properties:

```
 contentType:    string [or null if unknown],
 size:           int [or null if unknown],
 timeCreated:    string [the time created, formatted using ISO 8601, or null if unknown],
 timeUpdated:    string [the time updated, formatted using ISO 8601, or null if unknown],
 bucket:         string [or null if unknown],
 name:           string [or null if unknown],
 gsUri:          string [or null if unknown],
 googleServiceAccount: object, [null unless the DOS url belongs to a Bond supported host]
 hashes:         object [contains the hashes type and their checksum value. If unknown, it returns null]
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
    "hashes": {
        "md5": "336ea55913bc261b72875bd259753046",
        "sha256": "f76877f8e86ec3932fd2ae04239fbabb8c90199dab0019ae55fa42b31c314c44",
        "crc32c": "8a366443"
    }
}
```

**NOTE:**

There was an [early substitution recommendation to
users](https://app.zenhub.com/workspaces/orange-5d680d7e3eeb5f1bbdf5668f/issues/databiosphere/azul/1115), instructing
them to convert their URL schemes from "dos" to "drs". Some underlying servers hosting the DOS/DRS metadata have not yet
upgraded to support the DRS request path-prefix and DRS response JSON metadata, so `martha_v2` and `martha_v3` still 
communicates with those servers using the older request/response format.

At the same time, those server hosts are also working to submit test accounts for automated testing purposes. The final
list of supported `martha_v3` servers is still being finalized while those test accounts are being created.

Martha's `martha_v3` implementation translates requests-to and responses-from the following hosts:

- ✅ [Jade Data Repo](https://github.com/DataBiosphere/jade-data-repo#readme) (JDR)
    - Prod host: `jade-terra.datarepo-prod.broadinstitute.org`
    - Dev host: `jade.datarepo-dev.broadinstitute.org`
    - Martha Testing: 🤖 Continuous Automated
    - Returns Bond SA: No
    - Requires OAuth for metadata: 🔐 Yes
- ❌ [DataGuids.org](https://dataguids.org/) (ex: any drs://dg.* other than drs://dg.4503, and not drs://dataguids.org)
    - Prod host: `gen3.biodatacatalyst.nhlbi.nih.gov`
    - Dev host: `staging.gen3.biodatacatalyst.nhlbi.nih.gov`
    - Martha testing: 🖐 Manual (in production)
    - Returns Bond SA: Yes, via the [Data Coordination Platform](https://data.humancellatlas.org/about) (DCP)
    - Requires OAuth for metadata: 🔓 No
- ❌ [DataGuids.org](https://dataguids.org/) (ex: drs://dg.4503)
    - Prod host: `gen3.biodatacatalyst.nhlbi.nih.gov`
    - Dev host: `staging.gen3.biodatacatalyst.nhlbi.nih.gov`
    - Martha testing: 🖐 Manual
    - Returns Bond SA: Yes, via the [Data Commons Framework](https://datascience.cancer.gov/data-commons/data-commons-framework) (DCF)
    - Requires OAuth for metadata: 🔓 No
- ❌ [DataGuids.org](https://dataguids.org/) (ex: drs://dataguids.org, but not drs://dg.*)
    - Prod host: `dataguids.org`
    - Dev host: _unknown_
    - Martha testing: 🚫 No testing
    - Returns Bond SA: No
    - Requires OAuth for metadata: 🔓 No
- ❌ [Human Cell Atlas](https://github.com/HumanCellAtlas/data-store) (HCA)
    - Prod host: `drs.data.humancellatlas.org`
    - Dev host: _unknown_
    - Martha testing: 🖐 Manual (in production)
    - Returns Bond SA: No
    - Requires OAuth for metadata: 🔓 No
- ❌ [UCSC Single Cell Dev Server](https://drs.dev.singlecell.gi.ucsc.edu/)
    - Prod host: _unknown_
    - Dev host: `drs.dev.singlecell.gi.ucsc.edu`
    - Martha testing: 🚫 No testing
    - Returns Bond SA: No
    - Requires OAuth for metadata: 🔐 Yes
- ❌ [Analysis, Visualization and Informatics Lab-space](https://www.genome.gov/Funded-Programs-Projects/Computational-Genomics-and-Data-Science-Program/Genomic-Analysis-Visualization-Informatics-Lab-space-AnVIL) (AnVIL)
    - Prod host: _unknown_
    - Dev host: _unknown_
    - Martha testing: 🚫 No testing
    - Returns Bond SA: No
    - Requires OAuth for metadata: 🔓 No
- ❌ [Gabriella Miller Kids First Pediatric Data Resource](https://commonfund.nih.gov/kidsfirst/overview)
    - Prod host: _unknown_
    - Dev host: _unknown_
    - Martha testing: 🚫 No testing
    - Returns Bond SA: No
    - Requires OAuth for metadata: _unknown_

<sup>
✅ = DRS v1.0 hosts tested with Martha's `martha_v3` endpoint<br/>
❌ = Hosts that either a) don't support DRS v1.0, or b) haven't been tested with Martha's `martha_v3` endpoint
</sup>

Other DRS servers might work with Martha's `martha_v3` endpoint, however only the servers above are officially supported.
If you have an additional server you'd like to add to Martha, please store the test credentials in Vault and submit a PR
with both the integration test and updated documentation. If you do not have direct acces to Vault, please contact us
via [Jira](https://broadworkbench.atlassian.net/projects/WA/issues) to have your test credentials stored. NOTE: You will
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
 contentType:    string,
 size:           int,
 timeCreated:    string [dos objects only],
 updated:        string [usually],
 md5Hash:        string,
 bucket:         string,
 name:           string,
 gsUri:          string,
 googleServiceAccount: string, [always null]
 signedUrl:      string [absent for dos when caller is not linked in Bond]
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
Prerequisites: Node.js (^10.12.0, or >=12.0.0) built with SSL support
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

To run the Martha container, whether you are running a locally built image or an image pulled from quay.io, you must
start the container with appropriate port mapping between the host and the container.  You can choose whatever host
port you may require; in the following example port `58010` is used:

`docker run --publish 58010:8010 quay.io/broadinstitute/martha:latest`

## Building Docker Images

Public images are published to [quay.io](https://quay.io/repository/broadinstitute/martha?tab=tags) for each branch.

To build a new Docker image for Martha:

1. `cd` to the root of the Martha codebase
1. Run: `docker build -f docker/Dockerfile .`


## Logs (for live app)
* Can be viewed on Google Cloud Platform
  * Go to [console.cloud.google.com](https://console.cloud.google.com/)
  * Select Cloud Functions from the main (on the left side) menu
  * Find the version of the function you want to check
  * Click the vertical three dots and choose "view logs"
