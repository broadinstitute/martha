#!/usr/bin/env bash
set -e
set -x

VAULT_TOKEN=$1
GIT_BRANCH=$2

if [ "$GIT_BRANCH" == "dev" ]; then
    ENVIRONMENT="staging"
elif [ "$GIT_BRANCH" == "master" ]; then
    ENVIRONMENT="prod"
else
    echo "Git branch '$GIT_BRANCH' is not configured to automatically deploy to a target environment"
    exit 1
fi

# pull the credentials for the service account
# Commented out for now as there is not any data we need out of vault
# docker run --rm -e VAULT_TOKEN=$VAULT_TOKEN broadinstitute/dsde-toolbox vault read --format=json "secret/dsde/martha/$ENVIRONMENT/deploy-account.json" | jq .data > deploy_account.json

MARTHA_PATH=/martha
# Process all consul .ctmpl files
# Vault token is required by the docker image regardless of whether you having any data in Vault or not
docker run -v $PWD:${MARTHA_PATH} \
  -e INPUT_PATH=${MARTHA_PATH} \
  -e OUT_PATH=${MARTHA_PATH} \
  -e ENVIRONMENT=${ENVIRONMENT} \
  -e VAULT_TOKEN=${VAULT_TOKEN} \
  broadinstitute/dsde-toolbox render-templates.sh