# Smarty moderation service

This stack provides production moderation quarantine and an admin-only review API.

## Behavior

- `POST /moderation/report` creates an idempotent moderation case.
- `POST /moderation/block` atomically stores the user block and its moderation case.
- A reported post is atomically changed from its current visibility to `moderation_pending`.
- Existing feed clients already exclude that visibility, so the post remains absent while pending.
- `GET /admin/moderation/cases` requires membership in the `SmartyAdmins` Cognito group.
- `GET /admin/moderation/overview` returns admin-only queue and audit totals.
- `GET /admin/moderation/users` performs exact email or user-ID account lookup.
- `POST /admin/moderation/users/{userId}/status` suspends or reactivates an account and records the action.
- Suspending an account disables Cognito access and globally signs out its sessions. Admins cannot suspend themselves or another admin.
- `POST /admin/moderation/cases/{caseId}/decision` supports:
  - `approve`: restore the post's previous visibility.
  - `dismiss`: restore the post and dismiss the report.
  - `remove`: keep the post globally hidden as `moderation_removed`.
- Duplicate reports from the same user for the same content return the existing case instead of creating report spam.

## Deploy

Validate and deploy through CloudFormation/SAM in `us-east-1`:

```sh
sam validate --lint --template-file infrastructure/moderation/template.yaml
sam build --template-file infrastructure/moderation/template.yaml
sam deploy \
  --stack-name smarty-moderation-production \
  --region us-east-1 \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset
```

After deployment, add only trusted staff accounts to the group:

```sh
aws cognito-idp admin-add-user-to-group \
  --region us-east-1 \
  --user-pool-id us-east-1_URSwWqOE0 \
  --username USERNAME \
  --group-name SmartyAdmins
```

The staff member must sign out and sign in again so Cognito issues a token containing the new group claim.

## Verification

1. Report a test post from a non-admin account.
2. Confirm its `TextReels.visibility` is `moderation_pending` and it no longer appears from `GET /reels`.
3. Confirm a normal signed-in user receives `403` from the admin routes.
4. Sign in as a `SmartyAdmins` member and confirm the case appears in `/admin/moderation`.
5. Approve the case and confirm the original visibility is restored.
6. Report it again from a different test account, choose Remove, and confirm it remains absent.

The table uses on-demand billing, point-in-time recovery, encryption at rest, two query indexes, retained deletion policy, and 90-day structured Lambda logs.
