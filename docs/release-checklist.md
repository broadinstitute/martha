Martha Release Checklist
=========

## Prerequisites
1. Write access to the [Martha github repo](https://github.com/broadinstitute/martha)
1. Access to the [Quay Marthay repository](https://quay.io/repository/broadinstitute/martha)
1. The ability to run jobs on [this Jenkins server](https://fc-jenkins.dsp-techops.broadinstitute.org)
1. Valid [eRA Commons credentials](https://public.era.nih.gov/commons/public/login.do?TARGET=https%3A%2F%2Fpublic.era.nih.gov%2Fcommons%2FcommonsInit.do)

## Steps

1. Create a git tag for the new version of Martha to be deployed and push it to the github repo (if done locally).
    - e.g.: `git tag -a v1.4 -m "my version 1.4"`
    - [tags for past releases](https://github.com/broadinstitute/martha/releases) to figure out what the last tag was
    - [compare the latest code with the last version](https://github.com/broadinstitute/martha/compare) to figure out what the next tag should be using [semantic versioning](https://semver.org/)
    - [if you're looking for even more info on tags](https://git-scm.com/book/en/v2/Git-Basics-Tagging#_creating_tags) 
1. This should trigger a Circle CI build of a docker image with that new tag as its name. Go to [the Quay Martha repository](https://quay.io/repository/broadinstitute/martha) and log in with your Broad Google account to confirm that this has happened.
1. Deploy and test on dev (including manual test)
    1. Go to the [Jenkins manual deploy project](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created and "dev" as the TARGET.  Do not proceed until the job ends successfully.
        - You will need to be on the Broad network in order to have access.
    1. [Run the full manual test on the dev environment](manual-testing.md)
1. Deploy and test on the other non-prod environments
    1. Go to the [Jenkins manual deploy project](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created and "staging" as the TARGET.  Do not proceed until the job ends successfully.
    1. Link your test account to your ERA Commons account on staging (see [the link your account directions](manual-testing.md#link-your-account)) and run the following commands in a terminal
         ```
         gcloud auth login <your test account email>
         curl -X POST https://us-central1-broad-dsde-staging.cloudfunctions.net/martha_v2 -H "Authorization: Bearer $(gcloud auth print-access-token)" -d '{"url": "drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0"}' -H "Content-Type: application/json" | jq
    1. You should get a JSON object in response with the following structure:
        ```js
        {
          "dos": {
            "data_object": {
              ...
            }, 
            "googleServiceAccount": {
              ...
            }
          } 
        }
    1. Go to the [Jenkins manual deploy project](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created and "alpha" as the TARGET.  Do not proceed until the job ends successfully.
    1. Link your test account to your ERA Commons account on alpha (see [the link your account directions](manual-testing.md#link-your-account)) and run the following commands in a terminal
         ```
         gcloud auth login <your test account email>
         curl -X POST https://us-central1-broad-dsde-alpha.cloudfunctions.net/martha_v2 -H "Authorization: Bearer $(gcloud auth print-access-token)" -d '{"url": "drs://dg.712C/fa640b0e-9779-452f-99a6-16d833d15bd0"}' -H "Content-Type: application/json" | jq
    1. You should get a JSON object in response with the following structure:
        ```js
        {
          "dos": {
            "data_object": {
              ...
            }, 
            "googleServiceAccount": {
              ...
            }
          } 
        }
1. Deploy and test on prod (including manual test)
     1. Go to the [Jenkins prod manual deploy project](https://fcprod-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created (you shouldn't have a choice for TARGET).  Do not proceed until the job ends successfully.
         - You will need to be on the Broad network in order to have access.
     1. [Run the full manual test on the prod environment](manual-testing.md)
