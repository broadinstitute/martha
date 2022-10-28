Martha Deployment Key Rotation
==============================

The service account key used to deploy Martha needs to be rotated every 90 days.

1. Find the current WX ticket for rotating the deployment SA key. If these instructions were followed, it will be in the Slack notification that led you here. Add it to the current Jira board if it's not already there.
2. [Run the full manual test on the prod environment](https://docs.google.com/document/d/1-SXw-tgt1tb3FEuNCGHWIZJ304POmfz5ragpphlq2Ng). Not strictly necessary, but this is expected to pass and sets a current baseline to avoid surprises if the post-rotation test deploy fails.
3. Using your `@firecloud.org` account, [create a new key for the `cloud-functions-account@broad-dsde-prod.iam.gserviceaccount.com` service account](https://console.cloud.google.com/iam-admin/serviceaccounts/details/107440104000315564432/keys?project=broad-dsde-prod).
   1. Click `[ADD KEY]` > `Create new key`
   2. Select the JSON key type
   3. Click `[CREATE]` and make sure the key `.json` file downloads to your computer
4. Write this new key to vault.
```
vault write secret/dsde/martha/prod/deploy-account.json @/path/to/key.json
```
5. Disable or delete the existing key (id found on above page). Using your `@firecloud.org` account:
```
gcloud config set project broad-dsde-prod
gcloud iam service-accounts keys disable [key_id] --iam-account=cloud-functions-account@broad-dsde-prod.iam.gserviceaccount.com
```
6. Go to the [Jenkins prod manual deploy project](https://fcprod-jenkins.dsp-techops.broadinstitute.org/job/martha-manual-deploy/) and re-run the last Martha prod job. This will re-deploy the current version of Martha, verifying that the new service account key works.
7. Again, [run the full manual test on the prod environment](https://docs.google.com/document/d/1-SXw-tgt1tb3FEuNCGHWIZJ304POmfz5ragpphlq2Ng) to make sure Martha still works.
8. Clone the Jira ticket you've been working on, without cloning links or sprint fields. Update the due date to be 12 weeks (84 days) from today (which gives about a week to respond when the time comes).
9. Add a slack reminder in `#dsp-batch-private` to trigger 84 days from today. Make sure to include links to these instructions and the Jira ticket you just created.
```
/remind #dsp-workflows-private :redalert: Reminder to rotate the service account key for Martha prod deploys. https://github.com/broadinstitute/martha/blob/dev/docs/deployment-key-rotation.md [Link to Jira ticket] :redalert: at 9am in 84 days
```
