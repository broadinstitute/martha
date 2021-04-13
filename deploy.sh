#!/usr/bin/env bash
set -eo pipefail
set -x

VAULT_TOKEN="$1"
GIT_BRANCH="$2"
DEPLOY_ENV="$3"

set +x

if [[ -z "${DEPLOY_ENV}" ]]; then
    echo "DEPLOY_ENV argument not supplied; inferring from GIT_BRANCH '${GIT_BRANCH}'."

    if [[ "${GIT_BRANCH}" == "dev" ]]; then
        DEPLOY_ENV="dev"
    elif [[ "${GIT_BRANCH}" == "alpha" ]]; then
        DEPLOY_ENV="alpha"
    elif [[ "${GIT_BRANCH}" == "perf" ]]; then
        DEPLOY_ENV="perf"
    elif [[ "${GIT_BRANCH}" == "staging" ]]; then
        DEPLOY_ENV="staging"
    elif [[ "${GIT_BRANCH}" == "master" ]]; then
        DEPLOY_ENV="prod"
    else
        echo "Git branch '${GIT_BRANCH}' is not configured to automatically deploy to an environment"
        exit 1
    fi
fi

set -u

MARTHA_PATH=/martha
SERVICE_ACCT_KEY_FILE="deploy_account.json"
MARTHA_IMAGE="us.gcr.io/broad-dsp-gcr-public/martha:${GIT_BRANCH}"
DEPLOY_PROJECT_NAME="broad-dsde-${DEPLOY_ENV}"

if [[ "${DEPLOY_ENV}" =~ ^(cromwell-dev)$ ]]; then
    SOURCE_ENV="dev"
elif [[ "${DEPLOY_ENV}" =~ ^(dev|alpha|perf|staging|prod)$ ]]; then
    SOURCE_ENV="${DEPLOY_ENV}"
else
    echo "Unknown environment: ${DEPLOY_ENV} - must be one of [cromwell-dev, dev, alpha, perf, staging, prod]"
    exit 1
fi

echo "Deploying branch '${GIT_BRANCH}' from ${SOURCE_ENV} to ${DEPLOY_PROJECT_NAME}"
set -x

# Get the tier specific credentials for the service account out of Vault
# Put key into SERVICE_ACCT_KEY_FILE
docker run \
    --rm \
    --env "VAULT_TOKEN=${VAULT_TOKEN}" \
    broadinstitute/dsde-toolbox \
    vault read \
    --format=json "secret/dsde/martha/${DEPLOY_ENV}/deploy-account.json" |
jq .data > "${SERVICE_ACCT_KEY_FILE}"

# Process all Consul .ctmpl files
# Vault token is required by the docker image regardless of whether you having any data in Vault or not
docker run \
  --rm \
  --volume "$PWD:${MARTHA_PATH}" \
  --env "INPUT_PATH=${MARTHA_PATH}" \
  --env "OUT_PATH=${MARTHA_PATH}" \
  --env "ENVIRONMENT=${SOURCE_ENV}" \
  --env "VAULT_TOKEN=${VAULT_TOKEN}" \
  --env "RUN_CONTEXT=live" \
  --env "DNS_DOMAIN=NULL" \
  broadinstitute/dsde-toolbox render-templates.sh

# > Note: As of January 15, 2020, HTTP functions require authentication by default.
#
# via: https://cloud.google.com/functions/docs/securing/managing-access-iam#allowing_unauthenticated_function_invocation
#
# For every new cloud function deployed, across every environment, someone with the `owner` role will need to run:
#   ```
#   gcloud beta functions \
#     add-iam-policy-binding {FUNCTION_NAME} \
#     --member=allUsers --role=roles/cloudfunctions.invoker \
#     --project=broad-dsde-{DEPLOY_ENV}
#   ```
#
# Until that function is run, `allUsers` will receive a permission denied error when invoking the new Google Cloud
# Function.
#
# After an `owner` fixes the permissions using the above `gcloud` command, the function contents may be overwritten by
# any `editor`, including the Google Cloud Function service account stored in
# `secret/dsde/martha/${SOURCE_ENV}/deploy-account.json`. The Google Cloud Function will stay public to `allUsers` even
# when redeployed by an `editor`.

# Overriding ENTRYPOINT has some subtleties:
# https://medium.com/@oprearocks/how-to-properly-override-the-entrypoint-using-docker-run-2e081e5feb9d
#
# DO NOT TRY TO CHANGE THE ENTRYPOINT. Our Jenkins server is running a version of `docker` from circa 2017, and does not
# support newer CLI syntax for `--entrypoint`. If you are going to try to change the entrypoint, you definitely want
# to test your commands in Jenkins first!
#
# https://broadworkbench.atlassian.net/browse/WA-296

docker run \
    --rm \
    --entrypoint="/bin/bash" \
    --volume "$PWD:${MARTHA_PATH}" \
    --env BASE_URL="https://us-central1-broad-dsde-${DEPLOY_ENV}.cloudfunctions.net" \
    "${MARTHA_IMAGE}" \
    -c \
    "gcloud config set project ${DEPLOY_PROJECT_NAME} &&
      gcloud auth activate-service-account --key-file ${MARTHA_PATH}/${SERVICE_ACCT_KEY_FILE} &&
      cd ${MARTHA_PATH} &&
      gcloud beta functions deploy martha_v2 --trigger-http --source=. --runtime nodejs12 \\
        --allow-unauthenticated --project ${DEPLOY_PROJECT_NAME} &&
      gcloud beta functions deploy martha_v3 --trigger-http --source=. --runtime nodejs12 \\
        --allow-unauthenticated --project ${DEPLOY_PROJECT_NAME} &&
      gcloud beta functions deploy fileSummaryV1 --trigger-http --source=. --runtime nodejs12 \\
        --allow-unauthenticated --project ${DEPLOY_PROJECT_NAME} &&
      gcloud beta functions deploy getSignedUrlV1 --trigger-http --source=. --runtime nodejs12 \\
        --allow-unauthenticated --project ${DEPLOY_PROJECT_NAME} &&
      npm ci &&
      npm run-script smoketest"
