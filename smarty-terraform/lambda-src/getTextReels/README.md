# Feed reader

`GET /reels` keeps its existing pagination contract. Pass `media=video` for
public, playable videos from any topic, newest first. Supported responses include
`mediaType: "video"`. An empty page can still have a `nextCursor`; follow it
until it is null. The browser remains compatible with the older feed response.

The reader uses the existing `TextReels` `FeedIndex` and makes no data writes.
Video discovery reads at most two bounded windows per request with the default
configuration. The DynamoDB filter avoids returning text rows to the function;
it does not reduce the underlying read capacity used for those rows.

From the repository root:

```sh
python3 -B -m unittest discover -s smarty-terraform/lambda-src/getTextReels
zip -j /path/to/new/getTextReels.zip smarty-terraform/lambda-src/getTextReels/lambda_function.py
```

Release the existing `getTextReels` Lambda first, then the website. Before
releasing, keep the previous Lambda package for rollback. Smoke-test both
`/reels?limit=10` and `/reels?media=video&limit=20`, following cursors to
the end and checking for duplicates, missing public videos and excluded
non-public videos. No API Gateway, database or storage change is needed.
