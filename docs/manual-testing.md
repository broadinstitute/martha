Martha in Terra Manual End-to-End Test
=========

## Prerequisites
1. Valid [eRA Commons credentials](https://public.era.nih.gov/commons/public/login.do?TARGET=https%3A%2F%2Fpublic.era.nih.gov%2Fcommons%2FcommonsInit.do)
1. A Terra user with access to run workflows in the test workspace (and permissions in the associated billing account) for the environment in question.

## Steps
### Link your account
1. Log into the Terra UI for the environment under test
1. Go to your Profile page
    1. Click on the "hamburger menu" in the top left corner of the Terra UI
    1. Click on your User's Name
    1. Click "Profile"
1. On the right side of the page, you should see a section called: "IDENTITY & EXTERNAL SERVERS".  Under "DCP Framework Services by University of Chicago" click the link that says, "Log-In to Framework Services to re-link your account"
    - This will initiate an OAuth login sequence with DCP Fence
1. Authenticate with your eRA Commons credentials (if you have not done so already)
    - You will then be redirected back to "Gen3 Data Commons" where you will need to click the "Yes, I Authorize" button to "Authorize Broad to: Receive temporary Google credentials to access data on Google."
    - You should have been redirected back to your Profile page in the Terra UI.  Confirm that you are now "linked" with DCP Framework Services by University of Chicago" by the presence of your:
        - Username - should show your eRA Commons username
        - Link Expiration - should be 30 days in the future
1. Repeat the previous two steps for "DCF Framework Services by University of Chicago"

### Run the test workflow
1. Click on the hamburger menu in the top left of the page and click on "Your Workspaces"
1. Search for a Workspace named "DRS Test Workspace - " and then the environment (e.g. dev, staging, alpha or prod)
    - If you do not see the Workspace, you are either logged in as the wrong user, or your user needs to be granted access to the Workspace. 
1. Click into that Workspace and navigate to the Workflows tab
1. You should see a Workflow with a name that contains "md5sum"; click on that Workflow.
1. Under "Step 1", there should be a dropdown select box called "Select root entity type". Select the option: "data_access_test_drs_uris"
1. Unselect/disable the checkbox for "Use call caching"
1. Click the "Save" button
1. Click the "Run Analysis" button
1. A pop-up window should be displayed, click the "Launch" button
    - If you get a permission error, it is probable that you were not added to the billing project that is associated with this workspace.
    - You should be redirected to the "Job History"/"Workflow Status" page where you will be able to monitor the status of your workflow in the "Status" column of the data table.
    - The page should refresh automatically so that, after a few minutes, you can see the Status become "Running" and eventually "Succeeded".  

If the Status is "Succeeded", then the test has PASSED, if the Status is "Failed", then the test has FAILED.
