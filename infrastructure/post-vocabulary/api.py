"""Fast authenticated enqueue/status API; never calls an AI model."""
import json
import os

import boto3

import common as state

SQS = boto3.client("sqs", config=state.SDK_CONFIG)
QUEUE_URL = os.environ.get("QUEUE_URL", "")


def subject(event):
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user = claims.get("sub")
    return user if state.valid_id(user) else None


def unavailable(post_id):
    return state.response(200, {"status": "unavailable", "postId": post_id})


def pending(post_id, fingerprint, status="preparing"):
    return state.response(202, {"status": status, "postId": post_id, "sourceHash": fingerprint}, 3)


def prepare(post_id, user_id, post, fingerprint, job):
    timestamp = state.now()
    key = state.key_for(post_id, fingerprint)
    if job and int(job.get("attempts", 0)) >= state.MAX_ATTEMPTS:
        return unavailable(post_id)
    if job and job.get("status") == "enqueuing" and int(job.get("leaseUntil", 0)) > timestamp:
        # A producer lease is not proof that SQS accepted a message. Keep the
        # browser outbox until durable enqueue is confirmed, even after a crash.
        return state.response(503, {"error": "Word preparation is being queued. Your post is saved."},
                              max(1, int(job["leaseUntil"]) - timestamp))
    if state.active_job(job, timestamp):
        return pending(post_id, fingerprint)
    claim = state.replace_job(job, {"entryType": "postVocabularyJob", "sourceHash": fingerprint,
                                   "actorHash": state.digest(user_id), "status": "enqueuing",
                                   "attempts": int((job or {}).get("attempts", 0)),
                                   "leaseUntil": timestamp + state.ENQUEUE_LEASE_SECONDS}, key)
    try:
        state.reserve_author_budget(user_id, timestamp)
    except state.RateLimited:
        state.replace_job(claim, {"status": "enqueue_failed", "leaseUntil": 0})
        return state.response(429, {"error": "Word meanings are temporarily limited. Your post is saved."}, 3600 - timestamp % 3600)
    try:
        SQS.send_message(QueueUrl=QUEUE_URL,
                         MessageBody=json.dumps({"postId": post_id, "sourceHash": fingerprint, "authorId": user_id}),
                         MessageGroupId=state.digest(post_id), MessageDeduplicationId=state.digest(key + "\n" + user_id))
    except Exception:
        # An ambiguous network failure can already have delivered the message.
        # Preserve source-bound FIFO dedup on a later enqueue retry.
        try:
            state.replace_job(claim, {"status": "enqueue_failed", "leaseUntil": 0})
        except state.Busy:
            pass
        raise
    try:
        state.replace_job(claim, {"status": "queued", "queuedAt": timestamp, "leaseUntil": 0})
    except state.Busy:
        # The worker may have claimed/completed it before SendMessage returned.
        pass
    return pending(post_id, fingerprint, "queued")


def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "").upper()
    if method == "OPTIONS":
        return state.response(200, {})
    if method not in {"POST", "GET"}:
        return state.response(405, {"error": "Method not allowed"})
    user_id = subject(event)
    if not user_id:
        return state.response(401, {"error": "Please sign in to prepare word meanings."})
    if method == "POST":
        try:
            raw = event.get("body") or "{}"
            if not isinstance(raw, str) or len(raw) > 1024 or event.get("isBase64Encoded"):
                raise ValueError()
            body = json.loads(raw)
            post_id = body.get("postId") if isinstance(body, dict) else None
        except (ValueError, TypeError):
            return state.response(400, {"error": "Invalid request"})
    else:
        post_id = (event.get("queryStringParameters") or {}).get("postId")
    if not state.valid_id(post_id):
        return state.response(400, {"error": "Missing or invalid postId"})
    try:
        post = state.read_post(post_id)
        if not state.visible(post):
            return state.response(404, {"error": "Post not available"})
        if not state.owned(post, user_id) or state.generated(post):
            return state.response(403, {"error": "Only the author can prepare word meanings."})
        if not state.bounded_source(post):
            return state.response(400, {"error": "Post text cannot be prepared for word meanings."})
        glossary = state.saved_glossary(post)
        if glossary is not None:
            return state.response(200, {"status": "ready", "postId": post_id, "postGlossary": glossary, "cached": True})
        fingerprint = state.source_hash(post)
        job = state.read_job(state.key_for(post_id, fingerprint))
        if method == "GET":
            return pending(post_id, fingerprint) if state.active_job(job, state.now()) else unavailable(post_id)
        if not QUEUE_URL:
            return state.response(503, {"error": "Word meanings are not available yet. Your post is saved."}, 30)
        return prepare(post_id, user_id, post, fingerprint, job)
    except state.Busy:
        return state.response(503, {"error": "Word preparation is being queued. Your post is saved."}, 3)
    except Exception as error:
        state.LOG.warning("vocabulary_api_failed code=%s", state.safe_failure_code(error))
        return state.response(503, {"error": "Word meanings could not be queued. Your post is saved."}, 30)
