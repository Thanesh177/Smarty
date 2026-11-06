"""Authenticated member-profile reads for the existing profile endpoint."""

import re
from decimal import Decimal
from urllib.parse import unquote, urlsplit


FIELDS = (
    "userId", "username", "userName", "name", "displayName", "bio", "photoKey",
    "photoUrl", "profilePic", "avatarUrl", "profilePictureUrl", "followersCount",
    "followingCount", "postsCount", "reelsCount", "isPrivate", "profileVisibility",
    "isDeleted", "deletedAt", "status", "lastLoginSub",
)
FIELD_NAMES = {f"#field{i}": field for i, field in enumerate(FIELDS)}
PROJECTION = ", ".join(FIELD_NAMES)
PHOTO_PREFIXES = ("profiles/", "profile/", "avatars/", "uploads/profiles/", "uploads/profile/", "uploads/avatars/")


def member_id(value):
    if not isinstance(value, str):
        return ""
    value = value.strip()
    if not value or len(value) > 160 or re.search(r"[@\x00-\x1f\x7f]", value):
        return ""
    if value.lower() in {".", "..", "null", "undefined", "none", "unknown", "smarty-ai"}:
        return ""
    return value


def safe_name(*values):
    for value in values:
        if not isinstance(value, str):
            continue
        value = value.strip()
        if not value or ("@" in value and not re.fullmatch(r"@[\w.-]+", value)):
            continue
        if re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", value, re.I):
            continue
        return value[:80]
    return ""


def avatar_key(item, bucket):
    for field in ("photoKey", "photoUrl", "profilePic", "avatarUrl", "profilePictureUrl"):
        value = item.get(field)
        if not isinstance(value, str) or not value or len(value) > 4096:
            continue
        try:
            parsed = urlsplit(value)
        except ValueError:
            continue
        if parsed.scheme or parsed.netloc:
            host = parsed.hostname or ""
            if parsed.scheme != "https" or not (host == f"{bucket}.s3.amazonaws.com"
                    or (host.startswith(f"{bucket}.s3.") and host.endswith(".amazonaws.com"))):
                continue
        key = unquote(parsed.path).lstrip("/")
        if key.startswith(PHOTO_PREFIXES) and not any(part in {".", "..", ""} for part in key.split("/")):
            return key
    return ""


def public_profile(item, target, own, relationship, sign_photo, bucket):
    result = {
        "userId": target,
        "username": safe_name(item.get("username"), item.get("userName")),
        "name": safe_name(item.get("displayName"), item.get("name")),
        "bio": item["bio"].strip()[:600] if isinstance(item.get("bio"), str) else "",
        "isMe": own,
        "isPrivate": item.get("isPrivate") is True,
        "isFollowing": relationship == "approved",
        "requestPending": relationship == "pending",
    }
    for field in ("followersCount", "followingCount", "postsCount", "reelsCount"):
        value = item.get(field)
        if isinstance(value, (int, Decimal)) and not isinstance(value, bool) and value >= 0:
            result[field] = int(value)
    key = avatar_key(item, bucket)
    result["avatarUrl"] = sign_photo(key) if key else ""
    return result


def with_member_profiles(legacy, *, get_method, get_claims, response, users, blocks, follows, sign_photo, bucket):
    def handler(event, context):
        params = event.get("queryStringParameters") or {}
        if get_method(event) != "GET" or "userId" not in params:
            # The original account bootstrap, last-seen, and update logic is
            # intentionally untouched. A targeted read never enters it.
            return legacy(event, context)
        viewer = member_id(get_claims(event).get("sub"))
        if not viewer:
            return response(401, {"error": "Unauthorized"})
        target = member_id(params.get("userId"))
        if not target:
            return response(400, {"error": "Invalid member ID"})
        unavailable = {"error": "Member profile unavailable"}
        try:
            item = users.get_item(Key={"userId": target}, ProjectionExpression=PROJECTION,
                                  ExpressionAttributeNames=FIELD_NAMES).get("Item")
            if not item or item.get("userId") != target or item.get("deletedAt") or item.get("isDeleted") is True:
                return response(404, unavailable)
            if str(item.get("status", "")).lower() in {"deleted", "disabled", "suspended"}:
                return response(404, unavailable)
            target_accounts = {target, member_id(item.get("lastLoginSub"))} - {""}
            own = viewer in target_accounts
            relationship = ""
            if not own:
                if str(item.get("profileVisibility", "")).lower() in {"hidden", "private"}:
                    return response(404, unavailable)
                for account in sorted(target_accounts):
                    for owner, other in ((viewer, account), (account, viewer)):
                        block = blocks.get_item(Key={"userId": owner, "chatId": f"block#{other}"},
                                                ConsistentRead=True, ProjectionExpression="userId").get("Item")
                        if block:
                            return response(404, unavailable)
                relation = follows.get_item(Key={"followerId": viewer, "followingId": target},
                                            ProjectionExpression="#state", ExpressionAttributeNames={"#state": "status"}).get("Item") or {}
                relationship = relation.get("status", "")
            return response(200, {"profile": public_profile(item, target, own, relationship, sign_photo, bucket)})
        except Exception as error:
            # Never log claims, private profile data, or signed photo URLs.
            print("MEMBER_PROFILE_READ_FAILED", type(error).__name__)
            return response(503, {"error": "Profile service temporarily unavailable"})
    return handler
