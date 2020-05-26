Martha Manual Test
=========

## Prerequisite
1. Valid [eRA Commons credentials](https://public.era.nih.gov/commons/public/login.do?TARGET=https%3A%2F%2Fpublic.era.nih.gov%2Fcommons%2FcommonsInit.do)

## Steps
1. Log into the Terra UI for the environment under test
2. Go to your Profile page:
Click on the "hamburger menu" in the top left corner of the Terra UI
Click on your User's Name
Click "Profile"
On the right side of the page, you should see a section called: "IDENTITY & EXTERNAL SERVERS"
Under "DCP Framework Services by University of Chicago" click the link that says, "Log-In to Framework Services to re-link your account"
This will initiate an OAuth login sequence with DCP Fence
Authenticate with your eRA Commons credentials (if you have not done so already)
You will then be redirected back to "Gen3 Data Commons" where you will need to click the "Yes, I Authorize" button to "Authorize Broad to: Receive temporary Google credentials to access data on Google."
You should have been redirected back to your Profile page in the Terra UI.  Confirm that you are now "linked" with DCP Framework Services by University of Chicago" by the presence of your:
Username - should show your eRA Commons username
Link Expiration - should be 30 days in the future
Repeat steps #4 and #5 for "DCF Framework Services by University of Chicago"
Click on the hamburger menu in the top left of the page
Click on "Your Workspaces"
Search for a Workspace named "DRS Test Workspace - {ENV}" where "{ENV}" is the environment in which you are testing: dev, alpha, perf, staging, or prod
If you do not see the Workspace, you are either logged in as the wrong user or your user needs to be granted access to the Workspace. 
Click into that Workspace and navigate to the Workflows tab
You should see a Workflow named "md5sum", click into that Workflow
Under "Step 1", there should be a dropdown select box called "Select root entity type". 
Select the option: "data_access_test_drs_uris"
Unselect/disable the checkbox for "Use call caching"
Click the "Save" button
Click the "Run Analysis" button
A pop-up window should be displayed, click the "Launch" button
You should be redirected to the "Job History"/"Workflow Status" page where you should be able to monitor the status of your workflow in the "Status" column of the data table
The page should refresh automatically and after a few minutes, you should see the Status become "Running" and eventually "Succeeded".  
If the Status is "Succeeded", then the test has PASSED, if the Status is "Failed", then the test has FAILED
