#!/usr/bin/env bash
set -e
set -x

VAULT_TOKEN=$1
GIT_BRANCH=$2
TARGET_ENV=$3

set +x
if [ -z "$TARGET_ENV" ]; then
    echo "TARGET_ENV argument not supplied; inferring from GIT_BRANCH '$GIT_BRANCH'."

    if [ "$GIT_BRANCH" == "dev" ]; then
        TARGET_ENV="dev"
    elif [ "$GIT_BRANCH" == "alpha" ]; then
        TARGET_ENV="alpha"
    elif [ "$GIT_BRANCH" == "perf" ]; then
        TARGET_ENV="perf"
    elif [ "$GIT_BRANCH" == "staging" ]; then
        TARGET_ENV="staging"
    elif [ "$GIT_BRANCH" == "master" ]; then
        TARGET_ENV="prod"
    else
        echo "Git branch '$GIT_BRANCH' is not configured to automatically deploy to a target environment"
        exit 1
    fi
fi

if [[ "$TARGET_ENV" =~ ^(dev|alpha|perf|staging|prod)$ ]]; then
    ENVIRONMENT=${TARGET_ENV}
else
    echo "Unknown environment: $TARGET_ENV - must be one of [dev, alpha, perf, staging, prod]"
    exit 1
fi

echo "Deploying branch '${GIT_BRANCH}' to ${ENVIRONMENT}"
set -x

PROJECT_NAME="broad-dsde-${ENVIRONMENT}"

SERVICE_ACCT_KEY_FILE="deploy_account.json"
# Get the tier specific credentials for the service account out of Vault
# Put key into SERVICE_ACCT_KEY_FILE
docker run --rm -e VAULT_TOKEN=${VAULT_TOKEN} broadinstitute/dsde-toolbox vault read --format=json "secret/dsde/martha/${ENVIRONMENT}/deploy-account.json" | jq .data > ${SERVICE_ACCT_KEY_FILE}

MARTHA_PATH=/martha
# Process all Consul .ctmpl files
# Vault token is required by the docker image regardless of whether you having any data in Vault or not
docker run --rm -v $PWD:${MARTHA_PATH} \
  -e INPUT_PATH=${MARTHA_PATH} \
  -e OUT_PATH=${MARTHA_PATH} \
  -e ENVIRONMENT=${ENVIRONMENT} \
  -e VAULT_TOKEN=${VAULT_TOKEN} \
  -e RUN_CONTEXT=live \
  -e DNS_DOMAIN=NULL \
  broadinstitute/dsde-toolbox render-templates.sh

MARTHA_IMAGE=quay.io/broadinstitute/martha:${GIT_BRANCH}

# Overriding ENTRYPOINT has some subtleties: https://medium.com/@oprearocks/how-to-properly-override-the-entrypoint-using-docker-run-2e081e5feb9d

# > Note: As of January 15, 2020, HTTP functions require authentication by default.
#
# via: https://cloud.google.com/functions/docs/securing/managing-access-iam#allowing_unauthenticated_function_invocation
#
# For every new cloud functions deployed, across every environment, someone with owner access will need to run:
#   ```
#   gcloud beta functions \
#     add-iam-policy-binding {FUNCTION_NAME} \
#     --member=allUsers --role=roles/cloudfunctions.invoker \
#     --project=broad-dsde-{ENVIRONMENT}
#   ```
# After an owner fixes the perms, the function contents may be overwritten by any editor, including the Google Cloud
# Function service account stored in `secret/dsde/martha/${ENVIRONMENT}/deploy-account.json`, and will stay public.

docker run --rm \
    --entrypoint="/bin/bash" \
    -v $PWD:${MARTHA_PATH} \
    -e BASE_URL="https://us-central1-broad-dsde-${ENVIRONMENT}.cloudfunctions.net" \
    ${MARTHA_IMAGE} -c \
    "gcloud config set project ${PROJECT_NAME} &&
     gcloud auth activate-service-account --key-file ${MARTHA_PATH}/${SERVICE_ACCT_KEY_FILE} &&
     cd ${MARTHA_PATH} &&
     gcloud beta functions deploy martha_v2 --source=. --trigger-http --runtime nodejs8 &&
     gcloud beta functions deploy martha_v3 --source=. --runtime nodejs8 --trigger-http &&
     gcloud beta functions deploy fileSummaryV1 --source=. --runtime nodejs8 --trigger-http &&
     gcloud beta functions deploy getSignedUrlV1 --source=. --runtime nodejs8 --trigger-http &&
     npm ci &&
     npm run-script smoketest"
