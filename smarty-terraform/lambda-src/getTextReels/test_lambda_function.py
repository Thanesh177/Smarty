import importlib.util
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


class Condition:
    def __init__(self, field=None, matches=None):
        self.field = field
        self.matches = matches

    def eq(self, value):
        return Condition(matches=lambda row: row.get(self.field) == value)

    def exists(self):
        def matches(row):
            for part in self.field.split("."):
                if not isinstance(row, dict) or part not in row:
                    return False
                row = row[part]
            return True
        return Condition(matches=matches)

    def __or__(self, other):
        return Condition(matches=lambda row: self.matches(row) or other.matches(row))


def load_handler():
    spec = importlib.util.spec_from_file_location("smarty_feed_handler", Path(__file__).with_name("lambda_function.py"))
    module = importlib.util.module_from_spec(spec)
    sdk = SimpleNamespace(resource=lambda *_args, **_kwargs: SimpleNamespace(Table=lambda _name: None), client=lambda *_args, **_kwargs: None)
    with patch.dict(sys.modules, {
        "boto3": sdk,
        "boto3.dynamodb.conditions": SimpleNamespace(Key=Condition, Attr=Condition),
        "botocore.exceptions": SimpleNamespace(ClientError=type("ClientError", (Exception,), {}), BotoCoreError=type("BotoCoreError", (Exception,), {})),
    }):
        spec.loader.exec_module(module)
    return module


handler = load_handler()


def row(number, **attributes):
    return {"id": str(number), "feedType": "GLOBAL", "createdAt": 1794182400000 + number, **attributes}


class FakeIndex:
    def __init__(self, rows):
        self.rows = list(rows)
        self.calls = []

    def query(self, **kwargs):
        self.calls.append(kwargs)
        source = [row for row in self.rows if kwargs["KeyConditionExpression"].matches(row)]
        start = kwargs.get("ExclusiveStartKey")
        offset = next(index + 1 for index, row in enumerate(source) if row["id"] == start["id"]) if start else 0
        window = source[offset:offset + kwargs["Limit"]]
        condition = kwargs.get("FilterExpression")
        page = {"Items": [row for row in window if not condition or condition.matches(row)]}
        if offset + len(window) < len(source):
            page["LastEvaluatedKey"] = {key: window[-1][key] for key in handler.CURSOR_FIELDS}
        return page


class FeedPaginationTests(unittest.TestCase):
    def setUp(self):
        self.signer = SimpleNamespace(generate_presigned_url=lambda _method, Params, ExpiresIn: "https://signed.example/" + Params["Key"])
        self.patch = patch.object(handler, "s3", self.signer)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def call(self, **params):
        response = handler.lambda_handler({"queryStringParameters": params}, None)
        self.assertEqual(response["statusCode"], 200)
        return json.loads(response["body"])

    def collect(self, index, **params):
        pages = []
        with patch.object(handler, "table", index):
            cursor = None
            for _ in range(20):
                page = self.call(cursor=cursor, **params)
                pages.append(page)
                cursor = page["nextCursor"]
                if not cursor:
                    return pages
        self.fail("Cursor did not terminate")

    def test_mixed_feed_does_not_skip_rows_after_each_full_page(self):
        index = FakeIndex(row(i, videoKey="clip.mp4") if i % 2 else row(i) for i in range(1, 18))
        pages = self.collect(index, limit="3")
        self.assertEqual([int(item["id"]) for page in pages for item in page["items"]], list(range(1, 18)))
        self.assertTrue(all("mediaType" not in page for page in pages))
        self.assertTrue(all(call["Limit"] <= 3 for call in index.calls))

    def test_video_only_discovers_all_seven_across_sparse_and_empty_windows(self):
        video_ids = [2, 7, 20, 31, 46, 51, 69]
        index = FakeIndex(row(i, videoKey=f"clip-{i}.mp4") if i in video_ids else row(i) for i in range(80))
        with patch.object(handler, "VIDEO_QUERY_LIMIT", 4):
            pages = self.collect(index, media="video", limit="2")
        self.assertEqual([int(item["id"]) for page in pages for item in page["items"]], video_ids)
        self.assertTrue(all(page["mediaType"] == "video" for page in pages))
        self.assertTrue(any(page["count"] == 0 and page["nextCursor"] for page in pages))
        self.assertTrue(all(call["Limit"] == 4 for call in index.calls))

    def test_video_page_resumes_after_last_emitted_not_end_of_a_final_query(self):
        index = FakeIndex(row(i, videoUrl=f"https://media.example/{i}.mp4") for i in range(7))
        pages = self.collect(index, media="video", limit="2")
        self.assertEqual([page["count"] for page in pages], [2, 2, 2, 1])
        self.assertEqual(handler.decode_cursor(pages[0]["nextCursor"])["id"], "1")
        self.assertEqual([item["id"] for page in pages for item in page["items"]], list(map(str, range(7))))

    def test_private_deleted_and_moderated_videos_never_enter_public_video_feed(self):
        base = {"videoKey": "clip.mp4", "authorId": "member"}
        rows = [
            row(1, **base, visibility="private"), row(2, **base, moderationStatus="pending"),
            row(3, **base, moderationStatus="removed"), row(4, **base, deleted=True),
            row(5, **base, isPrivate=True), row(6, **base, visibility="moderation_removed"),
            row(7, **base, moderationStatus="approved"), row(8, videoUrl="javascript:example"),
        ]
        with patch.object(handler, "table", FakeIndex(rows)):
            videos, _ = handler.fetch_visible_feed_items(20, "member", video_only=True)
        self.assertEqual([post["id"] for post in videos], ["7"])

    def test_keeps_external_originals_and_prefers_newly_signed_playback_and_poster(self):
        key_host = handler.BUCKET_NAME + ".s3.us-east-1.amazonaws.com"
        index = FakeIndex([
            row(1, videoPlaybackKey="optimized/one.mp4", videoUrl="https://media.example/original.mov",
                videoPosterUrl=f"https://{key_host}/posters/one%20picture.jpg?expired=1"),
            row(2, video={"playbackUrl": "https://media.example/legacy.mp4"}),
            row(3, videoUrl="https://name:password@media.example/blocked.mp4"),
        ])
        [page] = self.collect(index, media="video")
        self.assertEqual(page["count"], 2)
        first, legacy = page["items"]
        self.assertEqual(first["videoPlaybackUrl"], "https://signed.example/optimized/one.mp4")
        self.assertEqual(first["videoUrl"], "https://media.example/original.mov")
        self.assertEqual(first["videoPosterUrl"], "https://signed.example/posters/one picture.jpg")
        self.assertEqual(legacy["videoPlaybackUrl"], "https://media.example/legacy.mp4")
        self.assertNotIn("video", legacy)

    def test_rejects_an_invalid_index_cursor_without_calling_the_database(self):
        index = FakeIndex([])
        with patch.object(handler, "table", index):
            cursor = handler.encode_cursor({"id": "one", "feedType": "OTHER", "createdAt": "time"})
            response = handler.lambda_handler({"queryStringParameters": {"cursor": cursor}}, None)
        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(index.calls, [])

    def test_existing_numeric_dynamodb_cursor_round_trips(self):
        key = {"id": "post", "feedType": "GLOBAL", "createdAt": 1794182400000}
        self.assertEqual(handler.decode_cursor(handler.encode_cursor(key)), key)


if __name__ == "__main__":
    unittest.main()
