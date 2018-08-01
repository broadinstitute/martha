Martha
=========

![alt text](https://raw.githubusercontent.com/broadinstitute/martha/dev/images/doctor_martha_jones_and_the_tardis.jpg)

A Google Cloud Function.
For a more general overview of Google Cloud Functions as DSP uses them please look
[here](https://docs.google.com/document/d/1VZIFVdu77fNs0MVKLY8QNqiVWza71ED0Bf1Fj8CRNGs/edit#).
Martha is an "external" service that can be deployed independently from the rest of Firecloud.

# Martha v1
To call `martha_v1`, perform an HTTP `POST` to the appropriate URL. The body of the request must be a JSON Object with
two values: a [DOS](https://data-object-service.readthedocs.io/en/latest/) URL and a regex pattern. Martha uses the
DOS URL to retrieve a data object, unpacks it, and returns the first link that matches the specified regex pattern.
For more details look [here](https://docs.google.com/document/d/1AyyI6L43te_DFWh8dXAiX0Qx-8f3JLKUIZe6xFwKMb0/edit#).

Staging: https://us-central1-broad-dsde-staging.cloudfunctions.net/martha_v1
Production: https://us-central1-broad-dsde-prod.cloudfunctions.net/martha_v1

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
 signedUrl:      string [absent for dos when caller is not linked in Bond]
```

# Development
## Setup
* Install Node 8, the current LTS
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
Deployments occur automatically whenever code is merged into specifically named branches in git:
* Any merge to `dev`, `staging`, or `alpha` branches will be deployed to the corresponding `broad-dsde-[env]` project.
* Any merge to `master` will be deployed to `broad-dsde-production`.

**NOTE:** Each deployment will redeploy all supported versions of functions.


## Logs (for live app)
* Can be viewed on Google Cloud Platform
  * Go to [console.cloud.google.com](https://console.cloud.google.com/)
  * Select Cloud Functions from the main (on the left side) menu
  * Find the version of the function you want to check
  * Click the vertical three dots and choose "view logs"
