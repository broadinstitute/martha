FROM node:8.11

## Prepare the image
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update && apt-get install -y -qq --no-install-recommends unzip && apt-get clean

# Install the Google Cloud SDK
ENV HOME /
RUN wget https://dl.google.com/dl/cloudsdk/channels/rapid/google-cloud-sdk.zip && unzip google-cloud-sdk.zip && rm google-cloud-sdk.zip
ENV PATH /google-cloud-sdk/bin:$PATH

RUN gcloud components update --quiet && gcloud components install beta --quiet
