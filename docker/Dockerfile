# NOTE: If editing this file then check if cleanup of .trivyignore is needed also!
FROM node:16.14.0-buster

## Prepare the image
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update \
    && apt-get install -y -qq --no-install-recommends unzip mariadb-common libmariadb3 \
    && apt-get clean

# Install the Google Cloud SDK
# Deployment still uses this image and requires gcloud.
# Unlike Google's former functions-emulator, Google's functions-framework does not use gcloud.
# Pinning google-cloud-sdk at 441.0.0 because later versions do not support Python 3.7
ENV HOME /
RUN wget https://storage.googleapis.com/cloud-sdk-release/google-cloud-cli-441.0.0-linux-x86_64.tar.gz -O google-cloud-sdk.tar.gz \
    && tar -xf google-cloud-sdk.tar.gz \
    && rm google-cloud-sdk.tar.gz
ENV PATH /google-cloud-sdk/bin:$PATH

# Install beta components (needed to get Google Cloud Functions Support)
RUN gcloud components install beta --quiet

# Home directory for Martha code
RUN mkdir /martha
WORKDIR /martha

# Install project dependencies
# Do this prior to copying over source files to take advantage of Docker layer caching of npm dependencies
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm ci

# Copy Martha source code into image AFTER installing dependencies
COPY . .

# Running the functions-framework on the port previously used by the functions-emulator, port 8010
EXPOSE 8010

ENTRYPOINT ["npm"]
CMD ["start"]
