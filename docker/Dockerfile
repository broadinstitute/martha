FROM node:8.15

## Prepare the image
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update \
    && apt-get install -y -qq --no-install-recommends unzip \
    && apt-get clean

# Install the Google Cloud SDK
ENV HOME /
RUN wget https://dl.google.com/dl/cloudsdk/channels/rapid/google-cloud-sdk.zip \
    && unzip google-cloud-sdk.zip \
    && rm google-cloud-sdk.zip
ENV PATH /google-cloud-sdk/bin:$PATH

# Update gcloud and install beta components (needed to get Google Cloud Functions Support)
RUN gcloud components update --quiet \
    && gcloud components install beta --quiet

# Home directory for Martha code
RUN mkdir /martha
WORKDIR /martha

# Install GCF Emulator and project dependencies
# Do this prior to copying over source files to take advantage of Docker layer caching of npm dependencies
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm install -g @google-cloud/functions-emulator \
    && npm ci

# Copy Martha source code into image AFTER installing dependencies
COPY . .

# Set an arbitrary projectId in the Cloud Functions configuration.  A project MUST be set in `gcloud config` first
# Need to set the emulator `bindHost` and `host` so that the functions are reachable from outside the container
RUN gcloud config set project dockerized-martha \
    && functions config set projectId dockerized-martha \
    && functions config set bindHost 0.0.0.0 \
    && functions config set host 0.0.0.0

# Functions callable on port 8010, Emulator REST API on port 8008
EXPOSE 8008 8010

# Emulator must be started in order to deploy functions.  We will stop the server so that we can set the Dockerfile
# ENTRYPOINT to be the the `functions start` command.  Deployed functions persist across emulator restarts.
RUN functions start \
    && functions deploy martha_v1 --trigger-http \
    && functions deploy martha_v2 --trigger-http \
    && functions deploy fileSummaryV1 --trigger-http \
    && functions deploy resolveDataObjectUriV1 --trigger-http \
    && functions deploy getSignedUrlV1 --trigger-http \
    && functions stop

ENTRYPOINT ["functions"]
CMD ["start", "--tail=true"]
