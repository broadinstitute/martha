#!/usr/bin/env bash
set -e
set -x

VAULT_TOKEN=$1
GIT_BRANCH=$2

if [ "$GIT_BRANCH" == "dev" ]; then
    ENVIRONMENT="dev"
elif [ "$GIT_BRANCH" == "alpha" ]; then
    ENVIRONMENT="alpha"
elif [ "$GIT_BRANCH" == "staging" ]; then
    ENVIRONMENT="staging"
elif [ "$GIT_BRANCH" == "master" ]; then
    ENVIRONMENT="prod"
else
    echo "Git branch '$GIT_BRANCH' is not configured to automatically deploy to a target environment"
    exit 1
fi

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
  broadinstitute/dsde-toolbox render-templates.sh

# Build the Docker image that we can use to deploy Martha
docker build -f docker/Dockerfile -t broadinstitute/martha:deploy .

docker run --rm -v $PWD:${MARTHA_PATH} \
    -e BASE_URL="https://us-central1-broad-dsde-${ENVIRONMENT}.cloudfunctions.net" \
    broadinstitute/martha:deploy /bin/bash -c \
    "gcloud config set project ${PROJECT_NAME};
     gcloud auth activate-service-account --key-file ${MARTHA_PATH}/${SERVICE_ACCT_KEY_FILE};
     cd ${MARTHA_PATH};
     gcloud beta functions deploy martha_v1 --trigger-http;
     gcloud beta functions deploy martha_v2 --trigger-http;
     npm install;
     npm run-script smoketest;"
