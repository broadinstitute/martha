Martha Release Checklist
=========

## Prerequisites
1. Write access to the [Martha github repo](https://github.com/broadinstitute/martha)
1. The ability to run jobs on [this Jenkins server](https://fc-jenkins.dsp-techops.broadinstitute.org)
1. Valid [eRA Commons credentials](https://public.era.nih.gov/commons/public/login.do?TARGET=https%3A%2F%2Fpublic.era.nih.gov%2Fcommons%2FcommonsInit.do)

## Steps

- [ ] Create a Github ticket for Martha release and copy this checklist there.
- [ ] Create a git tag for the new version of Martha to be deployed and push it to the github repo (if done locally).
    - e.g.: `git tag -a 1.5.2 -m "1.5.2" && git push origin 1.5.2`
    - [tags for past releases](https://github.com/broadinstitute/martha/tags) to figure out what the last tag was
    - [compare the latest code with the last version](https://github.com/broadinstitute/martha/compare) to figure out what the next tag should be using [semantic versioning](https://semver.org/)
    - [if you're looking for even more info on tags](https://git-scm.com/book/en/v2/Git-Basics-Tagging#_creating_tags)
- [ ] This should trigger a Circle CI build of a docker image with that new tag as its name. Confirm that this has happened
   by listing the google tags.
    - Run: `gcloud container images describe us.gcr.io/broad-dsp-gcr-public/martha:<tag>`
    - e.g.: `gcloud container images describe us.gcr.io/broad-dsp-gcr-public/martha:1.5.2`
- [ ] Deploy and run manual test on **DEV**
    1. Go to the [Jenkins manual deploy project](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created and "dev" as the TARGET.  Do not proceed until the job ends successfully.
        - You will need to be on the Broad network in order to have access.
    1. [Run the full manual test on the dev environment](https://docs.google.com/document/d/1-SXw-tgt1tb3FEuNCGHWIZJ304POmfz5ragpphlq2Ng). The linked document instructs you to log into external servers via your profile page. For all dev and other non-prod instances:
        * For NIH Account, enter any username you want in the fake login page, then click on the generated link to return to your profile.
        * For the other sites, log in with RAS account `Broadtestuser115`. Get the password from someone on the team if you're doing this for the first time.
- [ ] Deploy and run manual test on **ALPHA**
    1. Build on [Jenkins](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) as described in dev section above, setting TARGET to "alpha". 
    1. [Run the full manual test on the alpha environment](https://docs.google.com/document/d/1-SXw-tgt1tb3FEuNCGHWIZJ304POmfz5ragpphlq2Ng) (see notes on account linking in dev environment above).
- [ ] Deploy and run manual test on **STAGING**
    1. Build on [Jenkins](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) as described in dev section above, setting TARGET to "staging". 
    1. [Run the full manual test on the alpha environment](https://docs.google.com/document/d/1-SXw-tgt1tb3FEuNCGHWIZJ304POmfz5ragpphlq2Ng) (see notes on account linking in dev environment above).
- [ ] Deploy and run manual test on **PROD**
     1. Go to the [Jenkins prod manual deploy project](https://fcprod-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created (you shouldn't have a choice for TARGET).  Do not proceed until the job ends successfully.
         - You will need to be on the Broad network in order to have access.
     1. [Run the full manual test on the prod environment](https://docs.google.com/document/d/1-SXw-tgt1tb3FEuNCGHWIZJ304POmfz5ragpphlq2Ng). Use your real eRA Commons account to link with external services on your profile page.
