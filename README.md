Martha v1
=========

![alt text](https://raw.githubusercontent.com/broadinstitute/martha/dev/images/doctor_martha_jones_and_the_tardis.jpg)

A Google Cloud Function.
For a more general overview of Google Cloud Functions as DSP uses them please look [here](https://docs.google.com/document/d/1VZIFVdu77fNs0MVKLY8QNqiVWza71ED0Bf1Fj8CRNGs/edit#).
Martha is an “external” service that can be deployed independently from the rest of Firecloud.
Martha accepts two params: a “DOS” URI and a regex pattern, uses DOS URI to retrieve a data object, unpacks it, and returns the first link to match the regex pattern. 
For more details look [here](https://docs.google.com/document/d/1AyyI6L43te_DFWh8dXAiX0Qx-8f3JLKUIZe6xFwKMb0/edit#)

Staging url:
    https://us-central1-broad-dsde-staging.cloudfunctions.net/martha_v1  
Production url:
    https://us-central1-broad-dsde-prod.cloudfunctions.net/martha_v1  
    
Development: 
* Github and Google Cloud repos will be kept in sync by Google 
* IntelliJ does have a NodeJS plugin.
* Install GCF emulator with
   * npm install -g @google-cloud/functions-emulator
      * Make sure you’ve already installed npm
      * Only have to do this first time
* Emulator can be started/stopped/killed with following commands
   * functions start
   * functions stop
   * functions kill
* To deploy locally (for testing purposes) AFTER starting emulator
   * functions deploy martha_v<versionNumber> --trigger-http 
* To call locally
   * functions call martha_v<versionNumber> --data ‘{"url": "dos.url.here", "pattern" : "gs://"}’
* To read logs
   * functions logs read
* To run tests
   * npm test


Deployment:
Any merge to dev will be deployed to the broad-dsde-staging.
Any merge to master will be deployed to broad-dsde-production.


Logs (for live app):
* Can be viewed on Google Cloud Platform
   * Go to console.cloud.google.com
   * Select Cloud Functions from the main (on the left side) menu
   * Find the version of the function you want to check
   * Click the vertical three dots and choose “view logs”
