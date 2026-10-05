# Concrete learning guides - version 4

The frontend and AIcontent backend changes are local until separately deployed.
Deploy both together for the improved generation format; frontend-only release
improves presentation and built-in lessons, but cannot update the server prompt.

## Changes

- Teach the post's specific mechanism, not its broad category.
- Define 2 to 4 useful terms and trace numbered cause-and-effect steps.
- Work through one example with inputs, intermediate changes and an outcome.
- Change one condition to show why the outcome changes. Label invented values
  as hypothetical and separate historical counterfactuals from actual events.
- Connect the next narrow concept to a specific part of the current example.
- Reject missing, empty or truncated sections before caching.

## Shared cache behavior

Explanation schema 4 replaces schema 3 on demand; there is no mass regeneration
or deletion. Existing model/source-hash cache keys, database persistence,
conditional source updates and generation leases remain in place. Follow-up
answer keys include the teaching version so earlier answers do not override the
new format. Personal questions remain account-scoped.

## Verification

Run the existing AIcontent unit suites and the explanation-format,
learning-journey and request-cache frontend suites. Browser checks use synthetic
accounts and mocked generation responses, not real model calls. After deploying,
verify a previously cached version-3 post refreshes once, then confirm another
account receives the version-4 cached guide without a second generation. Review
real generated content for factual accuracy and example clarity before rollout.
