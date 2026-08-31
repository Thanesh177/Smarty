import base64
import hashlib
import json
import logging
import os
import re
import time
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError


logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
CASES_TABLE_NAME = os.environ.get("CASES_TABLE", "SmartyModerationCases")
REELS_TABLE_NAME = os.environ.get("REELS_TABLE", "TextReels")
BLOCKS_TABLE_NAME = os.environ.get("BLOCKS_TABLE", "UserBlocks")
REEL_ID_INDEX = os.environ.get("REEL_ID_INDEX", "reelId-index")
ADMIN_GROUP = os.environ.get("ADMIN_GROUP", "SmartyAdmins")
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
MAX_REASON_LENGTH = 1200
MAX_NOTES_LENGTH = 2000
MAX_PAGE_SIZE = 50

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
dynamodb_client = boto3.client("dynamodb", region_name=AWS_REGION)
cases_table = dynamodb.Table(CASES_TABLE_NAME)
reels_table = dynamodb.Table(REELS_TABLE_NAME)
blocks_table = dynamodb.Table(BLOCKS_TABLE_NAME)
cognito = boto3.client("cognito-idp", region_name=AWS_REGION)
serializer = TypeSerializer()

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
}

ALLOWED_CONTENT_TYPES = {"post", "comment", "user", "chat", "message"}
ALLOWED_DECISIONS = {"approve", "remove", "dismiss"}
SAFE_ID = re.compile(r"^[A-Za-z0-9_.:#/@+-]{1,240}$")
SAFE_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class DecimalEncoder(json.JSONEncoder):
    def default(self, value):
        if isinstance(value, Decimal):
            return int(value) if value % 1 == 0 else float(value)
        return super().default(value)


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": HEADERS,
        "body": json.dumps(body, cls=DecimalEncoder, ensure_ascii=False),
    }


def log_event(level, event_name, **fields):
    payload = {"event": event_name, **fields}
    getattr(logger, level)(json.dumps(payload, cls=DecimalEncoder, default=str))


def get_method(event):
    return str(
        event.get("requestContext", {}).get("http", {}).get("method") or ""
    ).upper()


def get_path(event):
    return str(event.get("rawPath") or event.get("path") or "")


def get_claims(event):
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    ) or {}


def get_user_id(event):
    return str(get_claims(event).get("sub") or "").strip()


def get_groups(event):
    raw_groups = get_claims(event).get("cognito:groups") or []

    if isinstance(raw_groups, list):
        return {str(group).strip() for group in raw_groups if str(group).strip()}

    text = str(raw_groups).strip().strip("[]")
    return {
        item.strip().strip("\"'")
        for item in text.split(",")
        if item.strip().strip("\"'")
    }


def require_admin(event):
    if ADMIN_GROUP not in get_groups(event):
        return response(403, {"error": "Admin access required"})
    return None


def parse_body(event):
    raw_body = event.get("body") or "{}"

    if event.get("isBase64Encoded"):
        raw_body = base64.b64decode(raw_body).decode("utf-8")

    if isinstance(raw_body, dict):
        return raw_body

    try:
        parsed = json.loads(raw_body)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def sanitize_text(value, limit):
    return " ".join(str(value or "").strip().split())[:limit]


def sanitize_id(value, field_name, required=True):
    normalized = str(value or "").strip()

    if not normalized and not required:
        return ""

    if not normalized or not SAFE_ID.fullmatch(normalized):
        raise ValueError(f"Invalid {field_name}")

    return normalized


def sanitize_snapshot(value):
    if not isinstance(value, dict):
        return {}

    return {
        "title": sanitize_text(value.get("title"), 300),
        "body": sanitize_text(value.get("body") or value.get("description"), 1200),
        "topic": sanitize_text(value.get("topic") or value.get("category"), 120),
        "creatorName": sanitize_text(value.get("creatorName") or value.get("author"), 160),
        "imageUrl": sanitize_text(value.get("imageUrl") or value.get("thumbnail"), 800),
    }


def serialize_item(item):
    return {key: serializer.serialize(value) for key, value in item.items()}


def encode_cursor(last_key):
    if not last_key:
        return None
    raw = json.dumps(last_key, cls=DecimalEncoder, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")


def decode_cursor(value):
    if not value:
        return None
    try:
        raw = base64.urlsafe_b64decode(str(value).encode("utf-8")).decode("utf-8")
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def find_post(post_id):
    if not post_id:
        return None

    result = reels_table.query(
        IndexName=REEL_ID_INDEX,
        KeyConditionExpression=Key("reelId").eq(post_id),
        Limit=1,
    )
    items = result.get("Items") or []
    return items[0] if items else None


def make_case_id(reporter_id, content_type, content_id):
    raw = f"{reporter_id}|{content_type}|{content_id}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:40]


def build_case(body, reporter_id, now):
    content_type = sanitize_text(body.get("contentType") or "user", 30).lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError("Invalid contentType")

    post_id = sanitize_id(body.get("postId"), "postId", required=False)
    content_id = sanitize_id(
        body.get("contentId") or post_id or body.get("reportedUserId"),
        "contentId",
    )
    reported_user_id = sanitize_id(
        body.get("reportedUserId"), "reportedUserId", required=False
    )
    reason = sanitize_text(body.get("reason"), MAX_REASON_LENGTH)

    if not reason:
        raise ValueError("Reason is required")

    case_id = make_case_id(reporter_id, content_type, content_id)
    return {
        "caseId": case_id,
        "status": "pending",
        "createdAt": now,
        "updatedAt": now,
        "reporterId": reporter_id,
        "reportedUserId": reported_user_id,
        "contentType": content_type,
        "contentId": content_id,
        "postId": post_id,
        "reason": reason,
        "source": sanitize_text(body.get("source") or "user-report", 100),
        "chatId": sanitize_text(body.get("chatId"), 240),
        "commentId": sanitize_text(body.get("commentId"), 240),
        "snapshot": sanitize_snapshot(body.get("contentSnapshot")),
    }


def block_item(reporter_id, reported_user_id, now):
    if not reported_user_id:
        raise ValueError("reportedUserId is required when blocking a user")
    if reporter_id == reported_user_id:
        raise ValueError("You cannot block yourself")

    return {
        "userId": reporter_id,
        "chatId": f"block#{reported_user_id}",
        "blockedId": reported_user_id,
        "createdAt": now,
        "source": "moderation-service",
    }


def block_transaction_item(item):
    return {
        "Put": {
            "TableName": BLOCKS_TABLE_NAME,
            "Item": serialize_item(item),
        }
    }


def save_block(item):
    if item:
        blocks_table.put_item(Item=item)


def create_report(event, should_block=False):
    reporter_id = get_user_id(event)
    if not reporter_id:
        return response(401, {"error": "Login required"})

    body = parse_body(event)
    now = int(time.time() * 1000)

    try:
        case = build_case(body, reporter_id, now)
        block = block_item(reporter_id, case["reportedUserId"], now) if should_block else None
    except ValueError as error:
        return response(400, {"error": str(error)})

    existing = cases_table.get_item(
        Key={"caseId": case["caseId"]}, ConsistentRead=True
    ).get("Item")
    if existing:
        # The existing case is already visible to staff. Persisting the block
        # remains safe and idempotent even when the report is a duplicate.
        save_block(block)
        return response(200, {
            "reported": True,
            "blocked": bool(block),
            "caseId": existing.get("caseId"),
            "status": existing.get("status"),
            "alreadyReported": True,
            "contentHidden": existing.get("contentType") == "post"
                and existing.get("status") in {"pending", "removed"},
        })

    post = find_post(case["postId"]) if case["contentType"] == "post" else None
    if post:
        case["postKey"] = str(post.get("id") or "")
        case["snapshot"] = {
            "title": sanitize_text(post.get("title"), 300),
            "body": sanitize_text(post.get("body"), 1200),
            "topic": sanitize_text(post.get("topic") or post.get("category"), 120),
            "creatorName": sanitize_text(post.get("creatorName") or post.get("author"), 160),
            "imageUrl": sanitize_text(post.get("imageUrl") or post.get("thumbnail"), 800),
        }
        previous_visibility = str(
            post.get("moderationPreviousVisibility")
            or post.get("visibility")
            or "public"
        ).strip()
        if previous_visibility.startswith("moderation_"):
            previous_visibility = "public"
        case["previousVisibility"] = previous_visibility

        already_removed = (
            str(post.get("moderationStatus") or "").lower() == "removed"
            or str(post.get("visibility") or "").lower() == "moderation_removed"
        )
        if already_removed:
            case["status"] = "removed"
            transaction_items = [{
                "Put": {
                    "TableName": CASES_TABLE_NAME,
                    "Item": serialize_item(case),
                    "ConditionExpression": "attribute_not_exists(caseId)",
                }
            }]
            if block:
                transaction_items.append(block_transaction_item(block))
            dynamodb_client.transact_write_items(TransactItems=transaction_items)
            return response(202, {
                "reported": True,
                "blocked": bool(block),
                "caseId": case["caseId"],
                "status": "removed",
                "contentHidden": True,
            })

        try:
            transaction_items = [
                    {
                        "Put": {
                            "TableName": CASES_TABLE_NAME,
                            "Item": serialize_item(case),
                            "ConditionExpression": "attribute_not_exists(caseId)",
                        }
                    },
                    {
                        "Update": {
                            "TableName": REELS_TABLE_NAME,
                            "Key": {"id": serializer.serialize(case["postKey"])},
                            "UpdateExpression": (
                                "SET #visibility = :pendingVisibility, "
                                "moderationStatus = :pendingStatus, "
                                "moderationCaseId = :caseId, "
                                "moderationUpdatedAt = :now, "
                                "moderationPreviousVisibility = if_not_exists("
                                "moderationPreviousVisibility, #visibility)"
                            ),
                            "ConditionExpression": (
                                "attribute_not_exists(moderationStatus) "
                                "OR moderationStatus <> :removedStatus"
                            ),
                            "ExpressionAttributeNames": {"#visibility": "visibility"},
                            "ExpressionAttributeValues": {
                                ":pendingVisibility": serializer.serialize("moderation_pending"),
                                ":pendingStatus": serializer.serialize("pending"),
                                ":removedStatus": serializer.serialize("removed"),
                                ":caseId": serializer.serialize(case["caseId"]),
                                ":now": serializer.serialize(now),
                            },
                        }
                    },
                ]
            if block:
                transaction_items.append(block_transaction_item(block))
            dynamodb_client.transact_write_items(TransactItems=transaction_items)
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == "TransactionCanceledException":
                existing = cases_table.get_item(
                    Key={"caseId": case["caseId"]}, ConsistentRead=True
                ).get("Item")
                if existing:
                    save_block(block)
                    return response(200, {
                        "reported": True,
                        "blocked": bool(block),
                        "caseId": existing.get("caseId"),
                        "status": existing.get("status"),
                        "alreadyReported": True,
                        "contentHidden": True,
                    })
            raise
    else:
        case["contentMissing"] = bool(case["contentType"] == "post")
        transaction_items = [{
            "Put": {
                "TableName": CASES_TABLE_NAME,
                "Item": serialize_item(case),
                "ConditionExpression": "attribute_not_exists(caseId)",
            }
        }]
        if block:
            transaction_items.append(block_transaction_item(block))
        dynamodb_client.transact_write_items(TransactItems=transaction_items)

    log_event(
        "info",
        "moderation_case_created",
        caseId=case["caseId"],
        contentType=case["contentType"],
        contentId=case["contentId"],
        reporterId=reporter_id,
        quarantined=bool(post),
    )

    return response(202, {
        "reported": True,
        "blocked": bool(block),
        "caseId": case["caseId"],
        "status": "pending",
        "contentHidden": bool(post),
    })


def list_cases(event):
    denied = require_admin(event)
    if denied:
        return denied

    params = event.get("queryStringParameters") or {}
    status = sanitize_text(params.get("status") or "pending", 30).lower()
    if status not in {"pending", "approved", "removed", "dismissed", "admin_action"}:
        return response(400, {"error": "Invalid status"})

    try:
        limit = max(1, min(int(params.get("limit") or 25), MAX_PAGE_SIZE))
    except (TypeError, ValueError):
        limit = 25

    query_kwargs = {
        "IndexName": "StatusCreatedAtIndex",
        "KeyConditionExpression": Key("status").eq(status),
        "ScanIndexForward": False,
        "Limit": limit,
    }
    cursor = decode_cursor(params.get("cursor"))
    if cursor:
        query_kwargs["ExclusiveStartKey"] = cursor

    result = cases_table.query(**query_kwargs)
    return response(200, {
        "items": result.get("Items") or [],
        "nextCursor": encode_cursor(result.get("LastEvaluatedKey")),
    })


def moderation_overview(event):
    denied = require_admin(event)
    if denied:
        return denied

    counts = {}
    for status in ("pending", "removed", "dismissed", "approved", "admin_action"):
        result = cases_table.query(
            IndexName="StatusCreatedAtIndex",
            KeyConditionExpression=Key("status").eq(status),
            Select="COUNT",
        )
        counts[status] = int(result.get("Count") or 0)

    return response(200, {
        "counts": counts,
        "adminGroup": ADMIN_GROUP,
        "generatedAt": int(time.time() * 1000),
    })


def user_attributes(attributes):
    return {
        str(item.get("Name") or ""): str(item.get("Value") or "")
        for item in (attributes or [])
        if item.get("Name")
    }


def public_user(user):
    attributes = user_attributes(user.get("Attributes") or user.get("UserAttributes"))
    created_at = user.get("UserCreateDate")
    return {
        "username": str(user.get("Username") or ""),
        "userId": attributes.get("sub") or str(user.get("Username") or ""),
        "email": attributes.get("email") or "",
        "name": attributes.get("name") or attributes.get("preferred_username") or "",
        "enabled": bool(user.get("Enabled", True)),
        "status": str(user.get("UserStatus") or "UNKNOWN"),
        "createdAt": created_at.isoformat() if hasattr(created_at, "isoformat") else created_at,
    }


def lookup_users(event):
    denied = require_admin(event)
    if denied:
        return denied
    if not USER_POOL_ID:
        return response(503, {"error": "User administration is not configured"})

    params = event.get("queryStringParameters") or {}
    query = sanitize_text(params.get("query") or params.get("q"), 320)
    if not query:
        return response(400, {"error": "Enter an exact email address or user ID"})

    if "@" in query:
        if not SAFE_EMAIL.fullmatch(query) or '"' in query or "\\" in query:
            return response(400, {"error": "Enter a valid email address"})
        result = cognito.list_users(
            UserPoolId=USER_POOL_ID,
            Filter=f'email = "{query}"',
            Limit=5,
        )
        users = result.get("Users") or []
    else:
        try:
            username = sanitize_id(query, "user ID")
            users = [cognito.admin_get_user(
                UserPoolId=USER_POOL_ID,
                Username=username,
            )]
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == "UserNotFoundException":
                users = []
            else:
                raise

    return response(200, {"items": [public_user(user) for user in users]})


def is_protected_admin(username):
    result = cognito.admin_list_groups_for_user(
        UserPoolId=USER_POOL_ID,
        Username=username,
        Limit=20,
    )
    return any(
        str(group.get("GroupName") or "") == ADMIN_GROUP
        for group in (result.get("Groups") or [])
    )


def record_admin_action(target, action, reason, admin_id, now):
    raw = f"{target}|{action}|{admin_id}|{now}".encode("utf-8")
    action_id = f"admin#{hashlib.sha256(raw).hexdigest()[:40]}"
    cases_table.put_item(Item={
        "caseId": action_id,
        "status": "admin_action_pending",
        "createdAt": now,
        "updatedAt": now,
        "reviewedAt": now,
        "reviewedBy": admin_id,
        "reportedUserId": target,
        "contentType": "user",
        "contentId": target,
        "action": action,
        "decision": action,
        "reason": reason,
        "source": "admin-control-center",
    })
    return action_id


def set_user_status(event):
    denied = require_admin(event)
    if denied:
        return denied
    if not USER_POOL_ID:
        return response(503, {"error": "User administration is not configured"})

    try:
        username = sanitize_id(
            (event.get("pathParameters") or {}).get("userId"),
            "userId",
        )
    except ValueError as error:
        return response(400, {"error": str(error)})

    body = parse_body(event)
    action = sanitize_text(body.get("action"), 30).lower()
    reason = sanitize_text(body.get("reason"), MAX_NOTES_LENGTH)
    if action not in {"suspend", "reactivate"}:
        return response(400, {"error": "Action must be suspend or reactivate"})
    if len(reason) < 8:
        return response(400, {"error": "Provide a clear reason of at least 8 characters"})

    admin_id = get_user_id(event)
    try:
        target = cognito.admin_get_user(UserPoolId=USER_POOL_ID, Username=username)
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "UserNotFoundException":
            return response(404, {"error": "User account not found"})
        raise
    target_attributes = user_attributes(target.get("UserAttributes"))
    target_sub = target_attributes.get("sub") or username
    if admin_id in {username, target_sub}:
        return response(400, {"error": "You cannot change your own admin access"})
    if is_protected_admin(username):
        return response(409, {"error": "Remove this user from the admin group before changing access"})

    now = int(time.time() * 1000)
    action_id = record_admin_action(username, action, reason, admin_id, now)
    try:
        if action == "suspend":
            cognito.admin_user_global_sign_out(UserPoolId=USER_POOL_ID, Username=username)
            cognito.admin_disable_user(UserPoolId=USER_POOL_ID, Username=username)
        else:
            cognito.admin_enable_user(UserPoolId=USER_POOL_ID, Username=username)

        cases_table.update_item(
            Key={"caseId": action_id},
            UpdateExpression="SET #status = :status, completedAt = :now, updatedAt = :now",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "admin_action",
                ":now": int(time.time() * 1000),
            },
        )
    except ClientError:
        cases_table.update_item(
            Key={"caseId": action_id},
            UpdateExpression="SET #status = :status, failedAt = :now, updatedAt = :now",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "admin_action_failed",
                ":now": int(time.time() * 1000),
            },
        )
        raise
    log_event(
        "info",
        "admin_user_access_changed",
        action=action,
        targetUserId=username,
        reviewedBy=admin_id,
        actionId=action_id,
    )
    return response(200, {
        "success": True,
        "action": action,
        "actionId": action_id,
        "user": {
            **public_user(target),
            "enabled": action == "reactivate",
        },
    })


def decision_status(decision):
    return "approved" if decision == "approve" else (
        "removed" if decision == "remove" else "dismissed"
    )


def resolve_related_cases(content_id, decision, admin_id, notes, now):
    if not content_id:
        return

    result = cases_table.query(
        IndexName="ContentCreatedAtIndex",
        KeyConditionExpression=Key("contentId").eq(content_id),
    )

    for item in result.get("Items") or []:
        if item.get("status") != "pending":
            continue
        try:
            cases_table.update_item(
                Key={"caseId": item["caseId"]},
                UpdateExpression=(
                    "SET #status = :status, decision = :decision, reviewedBy = :admin, "
                    "reviewedAt = :now, updatedAt = :now, reviewNotes = :notes"
                ),
                ConditionExpression="#status = :pending",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={
                    ":status": decision_status(decision),
                    ":pending": "pending",
                    ":decision": decision,
                    ":admin": admin_id,
                    ":now": now,
                    ":notes": notes,
                },
            )
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                raise


def decide_case(event):
    denied = require_admin(event)
    if denied:
        return denied

    case_id = sanitize_text((event.get("pathParameters") or {}).get("caseId"), 100)
    if not case_id:
        return response(400, {"error": "caseId is required"})

    body = parse_body(event)
    decision = sanitize_text(body.get("decision"), 30).lower()
    notes = sanitize_text(body.get("notes"), MAX_NOTES_LENGTH)
    if decision not in ALLOWED_DECISIONS:
        return response(400, {"error": "Decision must be approve, remove, or dismiss"})

    case = cases_table.get_item(
        Key={"caseId": case_id}, ConsistentRead=True
    ).get("Item")
    if not case:
        return response(404, {"error": "Moderation case not found"})
    if case.get("status") != "pending":
        return response(409, {"error": "This case has already been reviewed"})

    now = int(time.time() * 1000)
    admin_id = get_user_id(event)
    post_key = str(case.get("postKey") or "").strip()

    final_status = decision_status(decision)
    if case.get("contentType") == "post" and post_key:
        restored_visibility = str(case.get("previousVisibility") or "public").strip()
        if restored_visibility.startswith("moderation_"):
            restored_visibility = "public"
        final_visibility = (
            "moderation_removed" if decision == "remove" else restored_visibility
        )

        try:
            dynamodb_client.transact_write_items(TransactItems=[
                {
                    "Update": {
                        "TableName": CASES_TABLE_NAME,
                        "Key": {"caseId": serializer.serialize(case_id)},
                        "UpdateExpression": (
                            "SET #status = :status, decision = :decision, "
                            "reviewedBy = :admin, reviewedAt = :now, "
                            "updatedAt = :now, reviewNotes = :notes"
                        ),
                        "ConditionExpression": "#status = :pending",
                        "ExpressionAttributeNames": {"#status": "status"},
                        "ExpressionAttributeValues": {
                            ":status": serializer.serialize(final_status),
                            ":pending": serializer.serialize("pending"),
                            ":decision": serializer.serialize(decision),
                            ":admin": serializer.serialize(admin_id),
                            ":now": serializer.serialize(now),
                            ":notes": serializer.serialize(notes),
                        },
                    }
                },
                {
                    "Update": {
                        "TableName": REELS_TABLE_NAME,
                        "Key": {"id": serializer.serialize(post_key)},
                        "UpdateExpression": (
                            "SET #visibility = :visibility, moderationStatus = :status, "
                            "moderationUpdatedAt = :now REMOVE moderationCaseId"
                        ),
                        "ConditionExpression": "moderationStatus = :pending",
                        "ExpressionAttributeNames": {"#visibility": "visibility"},
                        "ExpressionAttributeValues": {
                            ":visibility": serializer.serialize(final_visibility),
                            ":status": serializer.serialize(final_status),
                            ":pending": serializer.serialize("pending"),
                            ":now": serializer.serialize(now),
                        },
                    }
                },
            ])
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == "TransactionCanceledException":
                return response(409, {"error": "This content has already been reviewed"})
            raise
    else:
        try:
            cases_table.update_item(
                Key={"caseId": case_id},
                UpdateExpression=(
                    "SET #status = :status, decision = :decision, reviewedBy = :admin, "
                    "reviewedAt = :now, updatedAt = :now, reviewNotes = :notes"
                ),
                ConditionExpression="#status = :pending",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={
                    ":status": final_status,
                    ":pending": "pending",
                    ":decision": decision,
                    ":admin": admin_id,
                    ":now": now,
                    ":notes": notes,
                },
            )
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                return response(409, {"error": "This case has already been reviewed"})
            raise

    resolve_related_cases(case.get("contentId"), decision, admin_id, notes, now)
    log_event(
        "info",
        "moderation_case_reviewed",
        caseId=case_id,
        decision=decision,
        reviewedBy=admin_id,
        contentId=case.get("contentId"),
    )
    return response(200, {
        "success": True,
        "caseId": case_id,
        "decision": decision,
        "contentRestored": decision in {"approve", "dismiss"},
        "contentRemoved": decision == "remove",
    })


def lambda_handler(event, context):
    method = get_method(event)
    path = get_path(event)

    if method == "OPTIONS":
        return response(200, {})

    try:
        if method == "POST" and path == "/moderation/report":
            return create_report(event)
        if method == "POST" and path == "/moderation/block":
            return create_report(event, should_block=True)
        if method == "GET" and path == "/admin/moderation/cases":
            return list_cases(event)
        if method == "GET" and path == "/admin/moderation/overview":
            return moderation_overview(event)
        if method == "GET" and path == "/admin/moderation/users":
            return lookup_users(event)
        if method == "POST" and path.startswith("/admin/moderation/users/") and path.endswith("/status"):
            return set_user_status(event)
        if method == "POST" and path.startswith("/admin/moderation/cases/") and path.endswith("/decision"):
            return decide_case(event)
        return response(404, {"error": "Route not found"})
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "ClientError")
        request_id = error.response.get("ResponseMetadata", {}).get("RequestId", "")
        log_event("error", "aws_error", code=code, requestId=request_id, path=path)
        return response(500, {"error": "Moderation service is temporarily unavailable"})
    except Exception as error:
        logger.exception("Moderation handler failed: %s", str(error))
        return response(500, {"error": "Moderation service is temporarily unavailable"})
