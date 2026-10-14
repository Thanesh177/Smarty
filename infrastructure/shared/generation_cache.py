"""Shared DynamoDB generation leases. Never call a model after a cache failure."""
import hashlib
import logging
import time
import uuid
from contextlib import contextmanager
from boto3.dynamodb.conditions import Attr


class GenerationBusy(RuntimeError):
    pass


@contextmanager
def generation_lease(table, key_name, identity, lease_seconds=960):
    # Default covers Lambda's maximum invocation lifetime. A bounded service may
    # opt into a shorter lease ONLY when it still exceeds that service's timeout.
    if isinstance(lease_seconds, bool) or not isinstance(lease_seconds, int) or not 30 <= lease_seconds <= 960:
        raise ValueError("Generation lease must be 30-960 seconds and exceed the invocation timeout")
    key = "generation-lock#" + hashlib.sha256(identity.encode()).hexdigest()
    owner = uuid.uuid4().hex
    now = int(time.time())
    item = {key_name: key, "owner": owner, "expiresAt": now + lease_seconds}
    try:
        table.put_item(
            Item=item,
            ConditionExpression=Attr(key_name).not_exists() | Attr("expiresAt").lte(now),
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException as error:
        raise GenerationBusy("Content is being prepared. Please retry shortly.") from error
    try:
        yield
    finally:
        try:
            table.put_item(
                Item={**item, "expiresAt": int(time.time())},
                ConditionExpression=Attr("owner").eq(owner),
            )
        except Exception:
            # The lease will expire even if release fails; never hide the result
            # or original generation error, and never log prompts or answers.
            logging.getLogger(__name__).warning("generation_lease_release_failed")
