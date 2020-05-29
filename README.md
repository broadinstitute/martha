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
 contentType:    string,
 size:           int,
 timeCreated:    string [the time created, formatted using ISO 8601],
 updated:        string [the time updated, formatted using ISO 8601, or the empty string '' if unknown],
 bucket:         string,
 name:           string,
 gsUri:          string,
 googleServiceAccount: object, [null unless the DOS url belongs to a Bond supported host]
 hashes:         object [contains the hashes type and their checksum value]
```

Example response for /martha_v3:

```
{
    "contentType": "application/octet-stream",
    "size": 156018255,
    "timeCreated": "2020-04-27T15:56:09.696Z",
    "updated": "2020-04-27T15:56:09.696Z",
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

`martha_v3` only handles URLs for servers that support requests via the DRS v1.0 path-prefix
`https://[hostname]/ga4gh/drs/v1/object/[path]`, and then return DRS v1.0 compatible JSON metadata.

There was an [early substitution recommendation to
users](https://app.zenhub.com/workspaces/orange-5d680d7e3eeb5f1bbdf5668f/issues/databiosphere/azul/1115), instructing
them to convert their URL schemes from "dos" to "drs". Some underlying servers hosting the DOS/DRS metadata have not yet
upgraded to support the DRS request path-prefix and DRS response JSON metadata, so `martha_v2` still communicates with
those servers using the older request/response format.

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
* Install GCF emulator with: `npm install -g @google-cloud/functions-emulator`
* Install dependencies: `npm install`
* Start the GCF emulator: `functions start`
* Deploy Martha to your local GCF emulator: `functions deploy <service> --trigger-http`.
  The emulator will re-deploy your code as you update it.
* Test the function: `functions call <service> --data '<json object>'`
  * Testing functions that require you to include `header` information in the request (such as an `authorization` header)
    will require you to use a tool like `curl` to test the function. To get the URL for the function running on your local
    emulator, run the command: `functions describe <service>`

## Google Cloud Functions (GCF) Emulator
* The emulator can be started/stopped/killed with following commands
  * `functions start`
  * `functions stop`
  * `functions kill`
* Read the GCF logs: `functions logs read`

## Run Tests

`npm test`

## Deployment
Deployments to the `dev` tier are triggered automatically whenever code is pushed/merged to the `dev` branch on github.

- [ ] Deployments to other tiers are triggered manually by running the 
      [Martha Manual Deploy](https://fc-jenkins.dsp-techops.broadinstitute.org/view/Indie%20Deploys/job/martha-manual-deploy/)
      job on the DSP Jenkins instance.  You should follow these steps in order to deploy:

- [ ] When the latest code passes tests in CircleCI, it is tagged `dev_tests_passed_[timestamp]` where `[timestamp]` is the
      epoch time when the tag was created.
- [ ] Create and push a new [semver](https://semver.org/) tag for this same commit.  You should look at the existing tags 
      to ensure that the tag is incremented properly based on the last released version.  Tags should be plain semver numbers 
      like `1.0.0` and should not have any additional prefix like `v1.0.0` or `releases/1.0.0`.  Suffixes are permitted so 
      long as they conform to the [semver spec](https://semver.org/).
- [ ] Navigate to 
      [Martha Manual Deploy](https://fc-jenkins.dsp-techops.broadinstitute.org/view/Indie%20Deploys/job/martha-manual-deploy/)
      and click the "Build with Parameters" link.  Select the `TAG` that you just created and the tier to which you want to 
      deploy.
- [ ] You must deploy to each of the following tiers one-by-one and [manually test](#live-testing) each tier as you deploy to       it:
    * `dev` - Technically, this same commit is already running on `dev` courtesy of the automatic deployment, but this
    is an important step to ensure that the tag can be deployed properly.
    * `alpha`
    * `perf`
    * `staging`
    * `prod` - In order to deploy to `prod`, you must be on the DSP Suitability Roster.  You will need to log into the 
    production Jenkins instance and use the "Martha Manual Deploy" job to release the same tag to production.

**NOTE:** 
* Each deployment will redeploy all supported versions of functions.
* It is critical that you perform a quick [manual test](#live-testing) on each tier as you deploy to it because automated testing 
capabilities for Martha are limited.
* It is important that you deploy to all tiers.  Because Martha is an "indie service", we should strive to make sure
that all tiers other than `dev` are kept in sync and are running the same versions of code.  This is essential so that
as other DSP services are tested during their release process, they can ensure that their code will work properly with 
the latest version of Martha running in `prod`. 

## Live Testing
A test suite exists that can be used to verify the functionality of Martha functions running on a specific live or local
environment: `local, dev, alpha, perf, staging, prod`.  

### Live Testing Pre-requisites
1. Determine which environment (`env`) you want to run against.
- [ ] Ensure that you have established Bond links between your User account and all supported Providers on that `env`.  You
      can set up these links using the Bond API or by navigating to your User Profile page in Firecloud UI.
1. This test will make a system call to `gcloud auth print-access-token`.  Therefore you will need to:
   1. Make sure you have the GCloud CLI installed.
   1. Ensure that you are logged into your `gcloud cli` as the same user that you linked in Bond in the previous step.

### Running Live Tests
To run the live tests with default settings:

    npm run live_test

This will run the tests against locally running Martha functions and will expect Martha to be using the public DRS 
resolvers (like [dataguids.org](http://dataguids.org)) as opposed to the 
[Mock DRS](https://github.com/broadinstitute/mock-drs) resolver.

The `live_test`s accept optional parameters:

    npm run live_test -- -- --env=[env] --mock --base_url=[https://...]

    There are 3 optional parameters you can pass:

        env         - Can be one of ['dev', 'staging', 'alpha', 'perf', 'prod'].  Used to automatically determine
                      the `base_url`.  Defaults to `local`.
        mock        - If present or set to `true`, then tests will use DRS URLs that are resolvable by the mock-drs
                      service.  If `mock` is absent or set to `false`, tests will use DRS URLs resolvable by the
                      live/public DRS resolvers.
        base_url    - The base URL (protocol and host) where the Martha functions will be called.  Set this option
                      if you want to override the `base_url` derived from the `env` option.  Defaults to
                      `http://localhost:8010/broad-dsde-dev/us-central1`.

**NOTE** -
The `-- --` syntax may seem odd, but it is required in order to 
[pass arguments](https://github.com/avajs/ava/blob/master/docs/recipes/passing-arguments-to-your-test-files.md) 
through `npm run` and into `ava`.  

#### Examples

Run `live_test` against the `dev` environment expecting that environment to be using the Mock DRS resolver:

    npm run live_test -- -- --env=dev --mock
    npm run live_test -- -- -e dev -m

Run `live_test` against the `staging` environment expecting that environment to be using the public DRS resolver:

    npm run live_test -- -- --env=staging 
    npm run live_test -- -- -e staging


## Docker

The Dockerfile for Martha builds a Docker image that, when run, does the following:

* Starts the [Google Cloud Functions Emulator](https://cloud.google.com/functions/docs/emulator)
* Deploys all supported Martha functions to the emulator
* Exposes ports: `8008` and `8010`
* Handles `HTTP` requests to the REST API and Functions respectively on the exposed ports

## Run the Docker Container

To run the Martha container, whether you are running a locally built image or an image pulled from quay.io, you must
start the container with appropriate port mappings between the host and the container.  You can choose whatever host
ports you may require, in the following example ports `58010` and `58008` are used:

`docker run -p 58010:8010 -p 58008:8008 quay.io/broadinstitute/martha:latest`

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
