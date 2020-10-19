FROM node:12-buster

## Prepare the image
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update \
    && apt-get install -y -qq --no-install-recommends unzip \
    && apt-get clean

# Install the Google Cloud SDK
# Deployment still uses this image and requires gcloud.
# Unlike Google's former functions-emulator, Google's functions-framework does not use gcloud.
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
