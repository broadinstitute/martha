Martha Release Checklist
=========

## Prerequisites
1. Write access to the [Martha github repo](https://github.com/broadinstitute/martha)
2. Access to the [Quay Marthay repository](https://quay.io/repository/broadinstitute/martha)
3. The ability to run jobs on [this Jenkins server](https://fc-jenkins.dsp-techops.broadinstitute.org)
4. Valid [eRA Commons credentials](https://public.era.nih.gov/commons/public/login.do?TARGET=https%3A%2F%2Fpublic.era.nih.gov%2Fcommons%2FcommonsInit.do)

## Steps

1. Create a git tag for the new version of Martha that we want to deploy and push it to the github repo (if you do it locally).
    - [tags for past releases](https://github.com/broadinstitute/martha/releases) to figure out what it last was
    - [compare the latest code with the last version](https://github.com/broadinstitute/martha/compare) to figure out what it should be using [semantic versioning](https://semver.org/)
    - [directions on how to create a tag](https://git-scm.com/book/en/v2/Git-Basics-Tagging#_creating_tags) if you need a refresher
2. This should trigger a Circle CI build of a docker image with that new tag as its name. Go to [the Quay Martha repository](https://quay.io/repository/broadinstitute/martha) and log in with your Broad Google account to confirm that this has happened.
3. Deploy and test on dev (including manual test)
    1. Go to the [Jenkins manual deploy project](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created and "dev" as the TARGET.  Do not proceed until the job ends successfully.
        - You will need to be on the Broad network in order to have access.
    2. [Run the manual test on the dev environment]()
4. Deploy and test on the other non-prod environments
    1. Go to the [Jenkins manual deploy project](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created and the environment as the TARGET.  Do not proceed until the job ends successfully.
5. Deploy and test on prod (including manual test)
     1. Go to the [Jenkins manual deploy project](https://fc-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and click on the "Build with Parameters" link.  For the parameters, you want to select the tag you just created and "prod" as the TARGET.  Do not proceed until the job ends successfully.
