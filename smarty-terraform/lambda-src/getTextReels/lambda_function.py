import json
import os
import base64
import logging
from decimal import Decimal
from urllib.parse import unquote, urlsplit

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError, BotoCoreError


logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
TABLE_NAME = os.environ.get("REELS_TABLE", "TextReels")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "smarty-post-images")
FEED_INDEX = os.environ.get("FEED_INDEX", "FeedIndex")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
SIGNED_URL_EXPIRES = int(os.environ.get("SIGNED_URL_EXPIRES", "3600"))
DEFAULT_LIMIT = int(os.environ.get("DEFAULT_LIMIT", "10"))
MAX_LIMIT = int(os.environ.get("MAX_LIMIT", "20"))
MAX_QUERY_ROUNDS = int(os.environ.get("MAX_QUERY_ROUNDS", "2"))
VIDEO_QUERY_LIMIT = 120
PUBLIC_VISIBILITIES = {"public", "published", "", "null"}
HIDDEN_MODERATION_STATES = {"pending", "pending_review", "removed", "rejected", "hidden"}
CURSOR_FIELDS = ("id", "feedType", "createdAt")
VIDEO_FIELDS = (
    "id", "reelId", "title", "body", "topic", "category", "visibility", "moderationStatus",
    "deleted", "isPrivate", "authorId", "userId", "creatorId", "reatorId", "author", "creatorName",
    "feedType", "createdAt", "updatedAt", "imageKey", "imageUrl", "thumbKey", "thumbUrl",
    "videoKey", "videoUrl", "videoPlaybackKey", "videoPlaybackUrl", "videoPosterKey",
    "videoPosterUrl", "posterUrl", "thumbnailUrl", "likes", "downloadAllowed",
)
FEED_FIELDS = VIDEO_FIELDS + (
    "photoUrl", "thumbnail", "coverImage", "mediaUrl", "aiExplanation", "simpleExplanation",
    "aiExplanationSourceHash", "aiExplanationUpdatedAt",
)

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
s3 = boto3.client("s3", region_name=AWS_REGION)

table = dynamodb.Table(TABLE_NAME)


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": HEADERS,
        "body": json.dumps(body, cls=DecimalEncoder, ensure_ascii=False),
    }


def encode_cursor(key):
    if not key:
        return None
    raw = json.dumps(key, cls=DecimalEncoder)
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")


def decode_cursor(cursor):
    if not cursor:
        return None

    try:
        raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
        parsed = json.loads(raw, parse_float=Decimal)
        if (
            isinstance(parsed, dict)
            and set(parsed) == set(CURSOR_FIELDS)
            and parsed.get("feedType") == "GLOBAL"
            and isinstance(parsed.get("id"), str) and parsed["id"]
            and type(parsed.get("createdAt")) in (int, Decimal)
            and Decimal(parsed["createdAt"]).is_finite()
        ):
            return parsed
        return None
    except Exception:
        return None


def extract_key(value):
    if not value:
        return None

    value = str(value).strip()
    if not value:
        return None

    if ".amazonaws.com/" in value:
        return value.split(".amazonaws.com/", 1)[-1].split("?", 1)[0]

    if value.startswith("http://") or value.startswith("https://"):
        return None

    return value.split("?", 1)[0]


def build_signed_url(value):
    if not value or value == "null":
        return None

    value = str(value).strip()
    if not value:
        return None

    if value.startswith("http://") or value.startswith("https://"):
        return value

    try:
        return s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": BUCKET_NAME,
                "Key": value,
                "ResponseCacheControl": "public, max-age=31536000",
            },
            ExpiresIn=SIGNED_URL_EXPIRES,
        )
    except Exception as e:
        logger.error("SIGNED URL ERROR for key %s: %s", value, str(e))
        return None


def parse_limit(params):
    try:
        requested = int((params or {}).get("limit", DEFAULT_LIMIT))
    except (TypeError, ValueError):
        requested = DEFAULT_LIMIT

    return max(1, min(requested, MAX_LIMIT))


def get_method(event):
    return event.get("requestContext", {}).get("http", {}).get("method", "")


def get_current_user_id(event):
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    return str(claims.get("sub") or "").strip()


def can_show_item(item, current_user_id):
    visibility = str(item.get("visibility") or "public").lower().strip()
    if not is_available(item):
        return False
    author_id = (
        item.get("authorId")
        or item.get("userId")
        or item.get("creatorId")
        or item.get("reatorId")
    )

    return (
        visibility in PUBLIC_VISIBILITIES
        or (
            visibility == "private"
            and current_user_id
            and str(author_id or "").strip() == current_user_id
        )
    )


def video_media_value(value):
    """Keep a direct URL, or resolve a storage key for this app's bucket."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or value.lower() == "null" or any(ord(c) < 32 or c == "\\" for c in value):
        return None
    try:
        parsed = urlsplit(value)
        if parsed.scheme.lower() in {"http", "https"} and parsed.hostname and not (parsed.username or parsed.password):
            host = parsed.hostname
            if host.startswith(f"{BUCKET_NAME}.s3") and host.endswith(".amazonaws.com"):
                return unquote(parsed.path.lstrip("/")) or None
            if (host == "s3.amazonaws.com" or (host.startswith(("s3.", "s3-")) and host.endswith(".amazonaws.com"))) and parsed.path.startswith(f"/{BUCKET_NAME}/"):
                return unquote(parsed.path[len(BUCKET_NAME) + 2:]) or None
            return value
        if not parsed.scheme and not parsed.netloc and parsed.path and not parsed.path.startswith("/"):
            return parsed.path
    except ValueError:
        pass
    return None


def video_media(item):
    legacy = item.get("video")
    legacy = legacy if isinstance(legacy, dict) else {}
    return (
        video_media_value(item.get("videoPlaybackKey")) or video_media_value(item.get("videoPlaybackUrl"))
        or video_media_value(legacy.get("playbackUrl")),
        video_media_value(item.get("videoKey")) or video_media_value(item.get("videoUrl"))
        or video_media_value(legacy.get("url")),
    )


def is_available(item):
    moderation = str(item.get("moderationStatus") or "").strip().lower()
    return moderation not in HIDDEN_MODERATION_STATES and item.get("deleted") is not True


def can_show_video(item):
    visibility = str(item.get("visibility") or "public").strip().lower()
    return visibility in PUBLIC_VISIBILITIES and item.get("isPrivate") is not True and is_available(item)


def hydrate_feed_item(item, media=None):
    hydrated = dict(item)
    for field in ("feedType", "video", "videoPlaybackKey", "videoPosterKey"):
        hydrated.pop(field, None)

    feed_image = (
        hydrated.get("thumbKey")
        or extract_key(hydrated.get("thumbUrl"))
        or hydrated.get("imageKey")
        or extract_key(hydrated.get("imageUrl"))
        or extract_key(hydrated.get("photoUrl"))
        or extract_key(hydrated.get("thumbnail"))
        or extract_key(hydrated.get("coverImage"))
        or extract_key(hydrated.get("mediaUrl"))
    )

    hydrated["imageUrl"] = build_signed_url(feed_image)
    optimized, original = media if media is not None else video_media(item)
    hydrated["videoUrl"] = build_signed_url(original)
    if optimized:
        hydrated["videoPlaybackUrl"] = build_signed_url(optimized)
    else:
        hydrated.pop("videoPlaybackUrl", None)
    poster = video_media_value(item.get("videoPosterKey")) or video_media_value(item.get("videoPosterUrl"))
    if poster:
        hydrated["videoPosterUrl"] = build_signed_url(poster)
    else:
        hydrated.pop("videoPosterUrl", None)

    return hydrated


def fetch_visible_feed_items(limit, current_user_id, start_cursor=None, video_only=False):
    visible_items = []
    last_key = start_cursor
    fields = VIDEO_FIELDS if video_only else FEED_FIELDS
    aliases = {f"#f{i}": field for i, field in enumerate(fields)}
    projection = ", ".join(aliases) + ", #video.#playback, #video.#original"
    aliases.update({"#video": "video", "#playback": "playbackUrl", "#original": "url"})

    for _ in range(MAX_QUERY_ROUNDS):
        query_kwargs = {
            "IndexName": FEED_INDEX,
            "KeyConditionExpression": Key("feedType").eq("GLOBAL"),
            "ScanIndexForward": False,
            "Limit": VIDEO_QUERY_LIMIT if video_only else limit - len(visible_items),
            "ProjectionExpression": projection,
            "ExpressionAttributeNames": aliases,
        }

        if video_only:
            query_kwargs["FilterExpression"] = (
                Attr("videoKey").exists() | Attr("videoUrl").exists() | Attr("videoPlaybackKey").exists()
                | Attr("videoPlaybackUrl").exists() | Attr("video.url").exists() | Attr("video.playbackUrl").exists()
            )

        if last_key:
            query_kwargs["ExclusiveStartKey"] = last_key

        query_result = table.query(**query_kwargs)
        items = query_result.get("Items", [])

        for index, item in enumerate(items):
            media = None
            if video_only:
                if not can_show_video(item):
                    continue
                media = video_media(item)
                if not any(media):
                    continue
            elif not can_show_item(item, current_user_id):
                continue

            visible_items.append(hydrate_feed_item(item, media))

            if len(visible_items) == limit:
                # Never advance past matching rows not yet sent to the caller.
                # If the whole batch was consumed, DynamoDB's own cursor is safe.
                next_key = (
                    {key: item[key] for key in CURSOR_FIELDS}
                    if index + 1 < len(items) else query_result.get("LastEvaluatedKey")
                )
                return visible_items, next_key

        last_key = query_result.get("LastEvaluatedKey")

        if not last_key:
            break

    return visible_items, last_key


def lambda_handler(event, context):
    method = get_method(event)

    if method == "OPTIONS":
        return response(200, {})

    if method and method != "GET":
        return response(405, {"error": "Method not allowed"})

    try:
        params = event.get("queryStringParameters") or {}
        cursor = params.get("cursor")
        limit = parse_limit(params)
        video_only = params.get("media") == "video"
        current_user_id = get_current_user_id(event)

        decoded_cursor = decode_cursor(cursor)
        if cursor and not decoded_cursor:
            return response(400, {"error": "Invalid cursor"})

        items, next_key = fetch_visible_feed_items(
            limit=limit,
            current_user_id=current_user_id,
            start_cursor=decoded_cursor,
            video_only=video_only,
        )

        return response(200, {
            "items": items,
            "count": len(items),
            "nextCursor": encode_cursor(next_key),
            **({"mediaType": "video"} if video_only else {}),
        })

    except ClientError as e:
        logger.error("DynamoDB ClientError: %s", e.response.get("Error", {}))
        return response(500, {"error": "Database error"})

    except BotoCoreError as e:
        logger.error("AWS BotoCoreError: %s", str(e))
        return response(500, {"error": "AWS service error"})

    except Exception as e:
        logger.exception("GET REELS ERROR: %s", str(e))
        return response(500, {"error": "Internal server error"})
