"""Authenticated news preferences, followed subjects and durable in-app alerts."""
import hashlib
import json
import logging
import os
import re
import time
import uuid
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.config import Config

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)
CONFIG = Config(connect_timeout=2, read_timeout=3, retries={"total_max_attempts": 2, "mode": "standard"})
DB = boto3.resource("dynamodb", config=CONFIG)
TABLE = DB.Table(os.environ.get("PERSONAL_NEWS_TABLE", "SmartyPersonalNews"))
NEWS_ENDPOINT = os.environ.get("NEWS_ENDPOINT", "https://po2hwyb2c6.execute-api.us-east-1.amazonaws.com/latest")
COUNTRIES = set("GLOBAL US CA IN GB AU NZ IE FR DE ES IT NL BE CH AT SE NO DK FI PL UA JP KR SG AE SA ZA NG KE EG BR MX AR CL CO PH ID MY PK BD".split())
MAX_FOLLOWS = 50
HEADERS = {"Content-Type": "application/json", "Cache-Control": "private, no-store",
           "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "https://smarty.wiki"),
           "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization"}


def response(status, payload):
    return {"statusCode": status, "headers": HEADERS,
            "body": json.dumps(payload, default=lambda value: int(value) if isinstance(value, Decimal) else str(value))}


def subject(value):
    if not isinstance(value, str):
        raise ValueError("Choose a story or subject to follow.")
    query = re.sub(r"\s+", " ", value).strip()
    if not 3 <= len(query) <= 100 or not re.fullmatch(r"[\w\s'-]+", query, re.UNICODE):
        raise ValueError("Use 3-100 letters, numbers or spaces for the subject.")
    query = " ".join(word for word in query.split() if word.upper() not in {"OR", "AND", "NOT"})
    if len(query) < 3:
        raise ValueError("Choose a more specific subject.")
    return query


def story_id(query):
    return hashlib.sha256(subject(query).casefold().encode()).hexdigest()[:32]


def normalize_preference(value):
    country = str(value.get("country", "GLOBAL")).upper()
    if country not in COUNTRIES:
        raise ValueError("Unsupported news country.")
    region = re.sub(r"\s+", " ", str(value.get("region") or "")).strip()
    if len(region) > 80 or (region and not re.fullmatch(r"[\w .'-]+", region, re.UNICODE)):
        raise ValueError("Invalid state or region.")
    if country == "GLOBAL":
        region = ""
    return {"chosen": True, "country": country, "region": region,
            "mode": "local" if value.get("mode") == "local" and country != "GLOBAL" else "world"}


def normalize_push_preference(value):
    zone = str(value.get("timezone") or "UTC")
    try:
        ZoneInfo(zone)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError("Invalid notification timezone.")
    quiet = value.get("quietHours") or {}
    if not isinstance(quiet, dict):
        raise ValueError("Invalid quiet hours.")
    def clock(name, default):
        text = str(quiet.get(name) or default)
        if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", text):
            raise ValueError("Invalid quiet hours.")
        return text
    return {"enabled": value.get("enabled") is True, "news": value.get("news") is True,
            "previews": value.get("previews") is not False,
            "smartDelivery": value.get("smartDelivery") is not False, "timezone": zone,
            "quietHours": {"enabled": quiet.get("enabled") is not False, "start": clock("start", "22:00"), "end": clock("end", "07:30")}}


def items_for(user_id, prefix, limit):
    return TABLE.query(KeyConditionExpression=Key("userId").eq(user_id) & Key("entryId").begins_with(prefix),
                       ScanIndexForward=False, Limit=limit, ConsistentRead=True).get("Items", [])


def public_state(user_id):
    preferences = TABLE.get_item(Key={"userId": user_id, "entryId": "preferences"}, ConsistentRead=True).get("Item", {})
    now = int(time.time())
    follows = items_for(user_id, "story#", MAX_FOLLOWS)
    alerts = items_for(user_id, "alert#", 30)
    return {"preferences": preferences.get("preferences"),
            "stories": [{"id": item["storyId"], "query": item["query"], "followedAt": item["createdAt"]} for item in follows],
            "updates": [{"id": item["entryId"], "query": item["query"], "body": item["body"],
                         "createdAt": item["createdAt"], "readAt": item.get("readAt", 0)}
                        for item in alerts if int(item.get("expiresAt", 0)) > now]}


def delete_personal_news(user_id):
    # Paginate with the SDK; deleting while manually advancing a scan can skip
    # records. This is called before the account identity is removed.
    paginator = TABLE.meta.client.get_paginator("query")
    with TABLE.batch_writer() as batch:
        for page in paginator.paginate(TableName=TABLE.name, KeyConditionExpression="userId = :user", ExpressionAttributeValues={":user": user_id}, ConsistentRead=True):
            for item in page.get("Items", []):
                batch.delete_item(Key={"userId": user_id, "entryId": item["entryId"]})


def change_follow(user_id, value):
    query = subject(value.get("query"))
    identity = story_id(query)
    key = {"userId": user_id, "entryId": "story#" + identity}
    current = TABLE.get_item(Key=key, ConsistentRead=True).get("Item")
    follow = value.get("follow")
    if not isinstance(follow, bool):
        raise ValueError("Choose whether to follow this subject.")
    if bool(current) == follow:
        return {"success": True, "following": follow}
    counter = {"userId": user_id, "entryId": "follow-count"}
    now = int(time.time())
    if follow:
        item = {**key, "storyId": identity, "query": query, "createdAt": now, "revision": str(time.time_ns()),
                "watchPartition": "active", "watchSort": user_id + "#" + identity, "seen": []}
        actions = [
            {"Put": {"TableName": TABLE.name, "Item": item, "ConditionExpression": "attribute_not_exists(entryId)"}},
            {"Update": {"TableName": TABLE.name, "Key": counter,
                        "UpdateExpression": "SET #c = if_not_exists(#c, :zero) + :one",
                        "ConditionExpression": "attribute_not_exists(#c) OR #c < :max",
                        "ExpressionAttributeNames": {"#c": "count"}, "ExpressionAttributeValues": {":zero": 0, ":one": 1, ":max": MAX_FOLLOWS}}},
        ]
    else:
        actions = [
            {"Delete": {"TableName": TABLE.name, "Key": key, "ConditionExpression": "attribute_exists(entryId)"}},
            {"Update": {"TableName": TABLE.name, "Key": counter,
                        "UpdateExpression": "SET #c = #c - :one", "ConditionExpression": "#c >= :one",
                        "ExpressionAttributeNames": {"#c": "count"}, "ExpressionAttributeValues": {":one": 1}}},
        ]
    try:
        TABLE.meta.client.transact_write_items(TransactItems=actions)
    except TABLE.meta.client.exceptions.TransactionCanceledException:
        latest = TABLE.get_item(Key=key, ConsistentRead=True).get("Item")
        if bool(latest) != follow:
            raise ValueError("Your 50 followed-story slots are full, or another update is still saving. Try again.")
    return {"success": True, "following": follow}


def report_time(article):
    try:
        parsed = datetime.fromisoformat(str(article.get("published_at", "")).replace("Z", "+00:00"))
        return int(parsed.timestamp()) if parsed.tzinfo else 0
    except (ValueError, TypeError):
        return 0


def new_reports(story, articles, now):
    terms = {word.casefold() for word in re.findall(r"\w+", story["query"]) if len(word) >= 3 and word.casefold() not in {"the", "and", "news", "latest", "reports"}}
    if not terms:
        return []
    seen = set(story.get("seen", []))
    unique = {}
    for article in articles:
        url = str(article.get("news_link", ""))
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username or parsed.password:
            continue
        identity = hashlib.sha256(url.encode()).hexdigest()[:32]
        published = report_time(article)
        if identity in seen or not int(story["createdAt"]) < published <= now + 300:
            continue
        words = {word.casefold() for word in re.findall(r"\w+", str(article.get("title", "")) + " " + str(article.get("summary", "")))}
        # Conservative subject matching. This is not a verified event chain.
        if len(terms & words) / len(terms) < .7:
            continue
        unique[identity] = {**article, "reportId": identity}
    return sorted(unique.values(), key=report_time, reverse=True)


def fetch_reports(query):
    # The server-configured URL is the only destination; users supply no URL.
    if not NEWS_ENDPOINT.startswith("https://"):
        raise RuntimeError("The news endpoint must use HTTPS.")
    url = NEWS_ENDPOINT + "?" + urllib.parse.urlencode({"view": "story", "query": query, "year": "recent", "month": "all"})
    with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=12) as result:
        payload = json.loads(result.read(2_000_000))
    if payload.get("kind") != "story-timeline" or not isinstance(payload.get("articles"), list):
        raise RuntimeError("The timeline service is unavailable.")
    return payload["articles"]


def publish_update(story, articles, now):
    key = {"userId": story["userId"], "entryId": story["entryId"]}
    latest = TABLE.get_item(Key=key, ConsistentRead=True).get("Item")
    if not latest or latest.get("revision") != story.get("revision"):
        return False
    reports = new_reports(latest, articles, now)
    if not reports:
        return False
    digest = hashlib.sha256((latest["storyId"] + "|" + "|".join(sorted(item["reportId"] for item in reports))).encode()).hexdigest()[:32]
    created = max(report_time(item) for item in reports)
    alert = {"userId": story["userId"], "entryId": f"alert#{created:010d}#{digest}", "query": latest["query"],
             "body": str(reports[0].get("title", "New related reporting"))[:240] + (f" · {len(reports) - 1} more related reports" if len(reports) > 1 else ""),
             "createdAt": created, "readAt": 0, "expiresAt": now + 90 * 86400,
             "storyId": latest["storyId"], "followRevision": latest["revision"],
             "pushState": "pending", "pushPartition": "pending", "pushDue": now, "pushAttempts": 0}
    seen = list(dict.fromkeys([*latest.get("seen", []), *(item["reportId"] for item in reports)]))[-200:]
    # Updating the checkpoint and alert together prevents duplicate delivery and
    # prevents a delayed worker from resurrecting an unfollowed subject.
    try:
        TABLE.meta.client.transact_write_items(TransactItems=[
            {"Put": {"TableName": TABLE.name, "Item": alert, "ConditionExpression": "attribute_not_exists(entryId)"}},
            {"Update": {"TableName": TABLE.name, "Key": key, "UpdateExpression": "SET seen = :seen, lastCheckedAt = :now",
                        "ConditionExpression": "revision = :revision", "ExpressionAttributeValues": {":seen": seen, ":now": now, ":revision": story["revision"]}}},
        ])
    except TABLE.meta.client.exceptions.TransactionCanceledException:
        return False
    return True


def check_updates(context):
    checkpoint_key = {"userId": "__system__", "entryId": "watch-cursor"}
    checkpoint = TABLE.get_item(Key=checkpoint_key, ConsistentRead=True).get("Item", {})
    cursor = checkpoint.get("cursor") or None
    fetched, processed, sent = {}, 0, 0
    now = int(time.time())
    options = {"IndexName": "ActiveWatches", "KeyConditionExpression": Key("watchPartition").eq("active"), "Limit": 25}
    if cursor:
        options["ExclusiveStartKey"] = cursor
    page = TABLE.query(**options)
    for story in page.get("Items", []):
        if context and context.get_remaining_time_in_millis() < 50000:
            break
        query = story["query"].casefold()
        if query not in fetched and len(fetched) >= 8:
            break
        try:
            if query not in fetched:
                fetched[query] = fetch_reports(story["query"])
            sent += int(publish_update(story, fetched[query], now))
        except Exception as error:
            LOGGER.warning(json.dumps({"event": "news_watch_check_failed", "errorType": type(error).__name__}))
            # Advance past an unavailable provider so one story cannot starve all
            # later users. It is retried when this bounded cursor wraps around.
        processed += 1
        cursor = {name: story[name] for name in ("userId", "entryId", "watchPartition", "watchSort")}
    if processed == len(page.get("Items", [])):
        cursor = page.get("LastEvaluatedKey")
    TABLE.put_item(Item={**checkpoint_key, "cursor": cursor, "checkedAt": now})
    LOGGER.info(json.dumps({"event": "news_watches_checked", "processed": processed, "updates": sent}))
    return {"processed": processed, "updates": sent}


def lambda_handler(event, context):
    # A separate worker entry point is used by the schedule, never HTTP input.
    method = str(event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod") or "").upper()
    if method == "OPTIONS":
        return response(204, {})
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = str(claims.get("sub") or "")
    if not user_id or user_id == "__system__":
        return response(401, {"error": "Sign in to manage your news."})
    path = str(event.get("rawPath") or event.get("path") or "")
    try:
        if method == "GET" and path.endswith('/news/personal'):
            return response(200, public_state(user_id))
        if method == "DELETE" and path.endswith('/news/personal'):
            delete_personal_news(user_id)
            return response(200, {"success": True})
        body = event.get("body") or "{}"
        if event.get("isBase64Encoded") or len(body) > 4096:
            raise ValueError("Invalid request body.")
        value = json.loads(body)
        if not isinstance(value, dict):
            raise ValueError("Invalid news settings.")
        if method == "PUT" and path.endswith('/news/preferences'):
            preference = normalize_preference(value)
            TABLE.put_item(Item={"userId": user_id, "entryId": "preferences", "preferences": preference})
            return response(200, {"success": True, "preferences": preference})
        if method == "PUT" and path.endswith('/news/push-preferences'):
            preferences = normalize_push_preference(value)
            TABLE.put_item(Item={"userId": user_id, "entryId": "push-preferences", "pushPreferences": preferences})
            return response(200, {"success": True})
        if method == "POST" and path.endswith('/news/follows'):
            if value.get("read"):
                entry_id = str(value["read"])
                if not re.fullmatch(r"alert#\d{10}#[a-f0-9]{32}", entry_id):
                    raise ValueError("Invalid news update.")
                try:
                    TABLE.update_item(Key={"userId": user_id, "entryId": entry_id}, UpdateExpression="SET readAt = :now",
                                      ExpressionAttributeValues={":now": int(time.time())}, ConditionExpression=Attr("entryId").exists())
                except TABLE.meta.client.exceptions.ConditionalCheckFailedException:
                    return response(404, {"error": "This update is no longer available."})
                return response(200, {"success": True})
            return response(200, change_follow(user_id, value))
        return response(405, {"error": "Method not allowed."})
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        return response(400, {"error": str(error)})
    except Exception as error:
        LOGGER.error(json.dumps({"event": "personal_news_failed", "errorType": type(error).__name__}))
        return response(503, {"error": "News settings are temporarily unavailable. Please try again."})


def worker_handler(event, context):
    return with_worker_lease("story-checker", lambda: check_updates(context))


def with_worker_lease(name, task):
    """A database lease limits overlapping jobs without consuming account reservations."""
    now, owner = int(time.time()), uuid.uuid4().hex
    key = {"userId": "__system__", "entryId": "worker-lease#" + name}
    try:
        TABLE.put_item(Item={**key, "owner": owner, "leaseUntil": now + 180},
                       ConditionExpression=Attr("entryId").not_exists() | Attr("leaseUntil").lte(now))
    except TABLE.meta.client.exceptions.ConditionalCheckFailedException:
        return {"skipped": "worker-already-running"}
    try:
        return task()
    finally:
        try:
            TABLE.delete_item(Key=key, ConditionExpression=Attr("owner").eq(owner))
        except TABLE.meta.client.exceptions.ConditionalCheckFailedException:
            pass
