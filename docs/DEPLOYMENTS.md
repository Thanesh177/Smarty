# Smarty web deployments

The web app uses GitHub Actions and Amplify Hosting manual deployments. It does not keep two servers running, so it provides blue-green-style atomic releases without the baseline cost of duplicate compute.

## Release flow

1. Every pull request to `main` must produce a successful production build.
2. A merge to `main` automatically deploys that exact commit to `staging`.
3. Test `https://staging.dgss25qxft1o4.amplifyapp.com`.
4. In GitHub Actions, open **Web deployment**, choose **Run workflow**, enter the tested commit SHA or tag, and choose `production`.
5. Confirm the workflow summary links to `https://production.dgss25qxft1o4.amplifyapp.com`.

The production GitHub environment should require a reviewer. That keeps production promotion deliberate while allowing staging to stay automatic.

## Rollback

Open **Web deployment**, run it with the last known-good commit SHA or release tag, and select `production`. The workflow rebuilds that exact version from the lockfile and replaces the hosted production artifact atomically.

Each deployment also stores its zip artifact in GitHub Actions for 14 days and writes `/release.json` into the site, making the deployed commit easy to identify.

## Initial AWS setup

The one-time CloudFormation stack creates:

- a `production` branch on the existing Amplify app;
- a GitHub OIDC identity provider, so there are no permanent AWS access keys in GitHub;
- a role restricted to starting and reading deployments for only the `staging` and `production` branches.

Validate and deploy `infrastructure/cicd/smarty-web-deploy.yaml` in `us-east-1` using the `agent-toolkit` AWS profile. The workflow already references the resulting stable role name.

## Traffic cutover

The repository still mentions an older Amplify hostname, while the active `us-east-1` app currently has only the `staging` branch. Do not change the customer-facing hostname until the production branch has been deployed and verified. Attach the custom domain or update the public URL only after that check.
