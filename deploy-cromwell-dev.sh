#!/usr/bin/env bash
set -eoux pipefail

GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
MARTHA_IMAGE="us.gcr.io/broad-dsp-gcr-public/martha:${GIT_BRANCH}"

docker build \
    --tag "${MARTHA_IMAGE}" \
    --file docker/Dockerfile \
    .

"$(dirname "$0")/deploy.sh" "$(cat ~/.vault-token)" "${GIT_BRANCH}" "cromwell-dev"
