"""Durable news outbox. Reuses the existing, IAM-only FCM sender contract."""
import json
import logging
import os
import time
import uuid
from datetime import datetime, timedelta
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.config import Config
from lambda_function import TABLE, with_worker_lease

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)
CONFIG = Config(connect_timeout=2, read_timeout=40, retries={"total_max_attempts": 1, "mode": "standard"})
LAMBDA = boto3.client("lambda", config=CONFIG)
SQS = boto3.client("sqs", config=Config(connect_timeout=2, read_timeout=3, retries={"total_max_attempts": 2, "mode": "standard"}))
SENDER = os.environ.get("PUSH_SENDER_ARN", "")
FAILURES_QUEUE = os.environ.get("PUSH_FAILURES_QUEUE", "")


def quiet_until(preferences, now):
    quiet = preferences.get("quietHours", {})
    if not preferences.get("smartDelivery", True) or not quiet.get("enabled", True):
        return now
    local = datetime.fromtimestamp(now, ZoneInfo(preferences.get("timezone", "UTC")))
    minute = local.hour * 60 + local.minute
    def minutes(value):
        hour, minute = map(int, value.split(":")); return hour * 60 + minute
    start, end = minutes(quiet.get("start", "22:00")), minutes(quiet.get("end", "07:30"))
    if start == end:
        return now + 86400  # All-day quiet time never leaks an alert.
    is_quiet = start <= minute < end if start < end else minute >= start or minute < end
    if not is_quiet:
        return now
    target = local.replace(hour=end // 60, minute=end % 60, second=0, microsecond=0)
    if minute >= end:
        target += timedelta(days=1)
    return int(target.timestamp())


def finish(key, owner, state, reason):
    TABLE.update_item(Key=key, UpdateExpression="SET pushState = :state, pushReason = :reason REMOVE pushPartition, pushDue, pushOwner, pushLeaseUntil",
                      ConditionExpression=Attr("pushOwner").eq(owner),
                      ExpressionAttributeValues={":state": state, ":reason": reason})


def defer(key, owner, due, attempts):
    TABLE.update_item(Key=key, UpdateExpression="SET pushDue = :due, pushAttempts = :attempts REMOVE pushOwner, pushLeaseUntil",
                      ConditionExpression=Attr("pushOwner").eq(owner), ExpressionAttributeValues={":due": due, ":attempts": attempts})


def deliver(item, now):
    key = {"userId": item["userId"], "entryId": item["entryId"]}
    owner = uuid.uuid4().hex
    try:
        claim = TABLE.update_item(Key=key, ReturnValues="ALL_NEW",
            UpdateExpression="SET pushOwner = :owner, pushLeaseUntil = :lease",
            ConditionExpression=Attr("pushState").eq("pending") & (Attr("pushLeaseUntil").not_exists() | Attr("pushLeaseUntil").lte(now)),
            ExpressionAttributeValues={":owner": owner, ":lease": now + 120})
    except TABLE.meta.client.exceptions.ConditionalCheckFailedException:
        return "claimed"
    item = claim["Attributes"]
    attempts = int(item.get("pushAttempts", 0))
    try:
        if now - int(item["createdAt"]) > 86400 or item.get("readAt"):
            finish(key, owner, "skipped", "expired-or-opened"); return "skipped"
        follow = TABLE.get_item(Key={"userId": item["userId"], "entryId": "story#" + item["storyId"]}, ConsistentRead=True).get("Item", {})
        if follow.get("revision") != item.get("followRevision"):
            finish(key, owner, "skipped", "unfollowed"); return "skipped"
        preferences = TABLE.get_item(Key={"userId": item["userId"], "entryId": "push-preferences"}, ConsistentRead=True).get("Item", {}).get("pushPreferences", {})
        if preferences.get("enabled") is not True or preferences.get("news") is not True:
            finish(key, owner, "skipped", "no-news-consent"); return "skipped"
        due = quiet_until(preferences, now)
        if due > now:
            defer(key, owner, due, attempts); return "quiet"
        if not SENDER:
            raise RuntimeError("Push sender is not configured.")
        # A synchronous acknowledgement is intentional: the old sender handles
        # its own FCM calls and returns counts; async acceptance is not delivery.
        result = LAMBDA.invoke(FunctionName=SENDER, InvocationType="RequestResponse", Payload=json.dumps({
            "userId": item["userId"], "title": "New reporting: " + item["query"], "body": item["body"],
            "data": {"type": "news", "userId": item["userId"], "notificationId": item["entryId"],
                     "receiptTable": TABLE.name, "url": "/news/story?" + urlencode({"q": item["query"], "year": "recent", "order": "newest"})}
        }).encode())
        payload = json.loads(result["Payload"].read())
        body = payload.get("body", {})
        if isinstance(body, str): body = json.loads(body)
        if result.get("FunctionError") or payload.get("statusCode", 500) >= 400 or int(body.get("failed", 0)) > 0:
            raise RuntimeError("Push sender did not confirm delivery.")
        # No registered devices is not a provider failure. The inbox is durable.
        if body.get("totalTokens") == 0 or body.get("skipped") or int(body.get("removed", 0)) == int(body.get("totalTokens", -1)):
            finish(key, owner, "skipped", "no-devices"); return "skipped"
        if int(body.get("sent", 0)) + int(body.get("deduplicated", 0)) <= 0:
            raise RuntimeError("Push sender returned no delivery acknowledgement.")
        finish(key, owner, "sent", "accepted-by-fcm"); return "sent"
    except Exception as error:
        LOGGER.warning(json.dumps({"event": "news_push_retry", "errorType": type(error).__name__, "attempt": attempts + 1}))
        attempts += 1
        if attempts >= 5:
            if FAILURES_QUEUE:
                SQS.send_message(QueueUrl=FAILURES_QUEUE, MessageBody=json.dumps(key))
            finish(key, owner, "failed", "delivery-not-confirmed"); return "failed"
        defer(key, owner, now + min(3600, 60 * 2 ** attempts), attempts); return "retry"


def dispatch(context):
    now = int(time.time())
    page = TABLE.query(IndexName="PendingPush", KeyConditionExpression=Key("pushPartition").eq("pending") & Key("pushDue").lte(now), Limit=25)
    counts = {}
    for item in page.get("Items", []):
        if context and context.get_remaining_time_in_millis() < 50000: break
        outcome = deliver(item, now); counts[outcome] = counts.get(outcome, 0) + 1
    LOGGER.info(json.dumps({"event": "news_push_batch", **counts}))
    return counts


def lambda_handler(event, context):
    return with_worker_lease("push-dispatcher", lambda: dispatch(context))
