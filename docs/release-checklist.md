Martha Release Checklist
=========

## Prerequisites
1. Write access to the [Martha github repo](https://github.com/broadinstitute/martha)
1. The ability to run jobs on [this Jenkins server](https://fc-jenkins.dsp-techops.broadinstitute.org)
1. Valid [eRA Commons credentials](https://public.era.nih.gov/commons/public/login.do?TARGET=https%3A%2F%2Fpublic.era.nih.gov%2Fcommons%2FcommonsInit.do)

## Steps

- [ ] Create a Github ticket for Martha release and copy this checklist there.  
- [ ] Create a git tag for the new version of Martha to be deployed and push it to the github repo (if done locally).  
    - e.g.: `git tag -a 1.5.2 -m "1.5.2"`  
    - [tags for past releases](https://github.com/broadinstitute/martha/releases) to figure out what the last tag was  
    - [compare the latest code with the last version](https://github.com/broadinstitute/martha/compare) to figure out what the next tag should be using [semantic versioning](https://semver.org/)  
    - [if you're looking for even more info on tags](https://git-scm.com/book/en/v2/Git-Basics-Tagging#_creating_tags)  
- [ ] This should trigger a Circle CI build of a docker image with that new tag as its name. Confirm that this has happened
   by listing the google tags.  
    - Run: `gcloud container images describe us.gcr.io/broad-dsp-gcr-public/martha:<tag>`  
    - e.g.: `gcloud container images describe us.gcr.io/broad-dsp-gcr-public/martha:1.5.2`  
- [ ] Deploy and test on dev (including manual test)  
    1. Go to the [Jenkins manual deploy project](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created and "dev" as the TARGET.  Do not proceed until the job ends successfully.  
        - You will need to be on the Broad network in order to have access.  
    1. [Run the full manual test on the dev environment](https://docs.google.com/document/d/1-SXw-tgt1tb3FEuNCGHWIZJ304POmfz5ragpphlq2Ng)  
- [ ] Deploy and test on the other non-prod environments  
    1. Go to the [Jenkins manual deploy project](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created and "staging" as the TARGET.  Do not proceed until the job ends successfully.  
    1. Link your test account to your ERA Commons account on staging (see [the link your account directions within the manual test doc](https://docs.google.com/document/d/1-SXw-tgt1tb3FEuNCGHWIZJ304POmfz5ragpphlq2Ng)) and run the following commands in a terminal  
         ```
         gcloud auth login <your test account email>
         curl -X POST https://us-central1-broad-dsde-staging.cloudfunctions.net/martha_v3 -H "Authorization: Bearer $(gcloud auth print-access-token)" -d '{"url": "drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0"}' -H "Content-Type: application/json" | jq
         ```
    1. You should get a JSON object in response with the following structure:  
        ```js
        {
          "contentType": "...",
          ...
          "googleServiceAccount": {
            ...
          }
        }
        ```
    1. Go to the [Jenkins manual deploy project](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created and "alpha" as the TARGET.  Do not proceed until the job ends successfully.  
    1. Link your test account to your ERA Commons account on alpha (see [the link your account directions within the manual test doc](https://docs.google.com/document/d/1-SXw-tgt1tb3FEuNCGHWIZJ304POmfz5ragpphlq2Ng)) and run the following commands in a terminal  
         ```
         gcloud auth login <your test account email>
         curl -X POST https://us-central1-broad-dsde-alpha.cloudfunctions.net/martha_v3 -H "Authorization: Bearer $(gcloud auth print-access-token)" -d '{"url": "drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0"}' -H "Content-Type: application/json" | jq
         ```
    1. You should get a JSON object in response with the following structure:  
        ```js
        {
          "contentType": "...",
          ...
          "googleServiceAccount": {
            ...
          }
        }
        ```
- [] Deploy and test on prod (including manual test)  
     1. Go to the [Jenkins prod manual deploy project](https://fcprod-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created (you shouldn't have a choice for TARGET).  Do not proceed until the job ends successfully.  
         - You will need to be on the Broad network in order to have access.  
     1. [Run the full manual test on the prod environment](https://docs.google.com/document/d/1-SXw-tgt1tb3FEuNCGHWIZJ304POmfz5ragpphlq2Ng)  
