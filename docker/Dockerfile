# NOTE: If editing this file then check if cleanup of .trivyignore is needed also!
FROM node:12.19.0-buster

## Prepare the image
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update \
    && apt-get install -y -qq --no-install-recommends unzip mariadb-common \
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

# Need to update for Trivy found CVE-2019-20367 in libbsd0 0.9.1-2
# Feel free to remove after upgrading the docker image to a debian release newer than buster
# - https://packages.debian.org/search?keywords=libbsd0
# - https://security-tracker.debian.org/tracker/CVE-2019-20367
# NOTE: If removing this block then update/remove .trivyignore also!
RUN printf "deb http://deb.debian.org/debian testing main\n" >> /etc/apt/sources.list \
    && printf "deb-src http://deb.debian.org/debian testing main\n" >> /etc/apt/sources.list \
    && apt-get update \
    && apt-get -t testing -y install libbsd0=0.10.0-1 \
    && apt-get clean
