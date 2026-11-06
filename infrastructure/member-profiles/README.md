# Member profiles

The existing authenticated `GET /users/profile` is also the account bootstrap.
The previous handler ignored the `userId` query parameter, so another member's
page received the viewer's account. The additive wrapper distinguishes:

- No `userId`: keep the original current-account flow, including initialization.
- `?userId=…`: a read-only lookup of that member, even if they have no posts.
- PUT/POST/OPTIONS: keep the original handler and authorization behavior.

Targeted reads use exact keys in `SmartyUsers`, `UserBlocks`, and `UserFollows`;
there is no scan, schema change, or backfill. The response is allowlisted.
Missing, hidden, deleted, or blocked members return the same unavailable
response. Blocks are checked in both directions and a failed check fails closed.
Only profile-image paths are eligible for avatar signing.

## Verify and release

1. Run `python3 -B -m unittest discover -s infrastructure/member-profiles`
   and the frontend tests.
2. Keep a private copy of the existing `updateUserProfile` deployment archive
   for rollback. Run `node infrastructure/member-profiles/package-release.mjs
   <existing-archive> <new-archive>`. The package builder checks the reviewed
   source hash before adding the read-only wrapper and preserves the existing handler.
3. Before publishing, confirm the existing execution role can read the two
   relationship tables with `dynamodb:GetItem`. If it cannot, review and approve
   a narrowly scoped permission for those tables. No JWT or route changes are needed.
4. Release the backend before the website. Verify with two authenticated test
   accounts: own profile, a member with no posts, the member's username link,
   blocked/missing member, and that editing one's own profile still works.
   If any check fails, restore the backed-up archive before publishing the frontend.
