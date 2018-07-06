FROM node:6.14

## Prepare the image
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update
RUN apt-get install -y -qq --no-install-recommends unzip
RUN apt-get clean

# Install the Google Cloud SDK
ENV HOME /
RUN wget https://dl.google.com/dl/cloudsdk/channels/rapid/google-cloud-sdk.zip
RUN unzip google-cloud-sdk.zip
RUN rm google-cloud-sdk.zip
ENV PATH /google-cloud-sdk/bin:$PATH

RUN gcloud components update --quiet
RUN gcloud components install beta --quiet