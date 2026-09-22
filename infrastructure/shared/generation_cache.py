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
def generation_lease(table, key_name, identity):
    # Longer than Lambda's maximum invocation lifetime; a timed-out writer cannot
    # outlive its lease and overwrite a replacement writer's result.
    key = "generation-lock#" + hashlib.sha256(identity.encode()).hexdigest()
    owner = uuid.uuid4().hex
    now = int(time.time())
    item = {key_name: key, "owner": owner, "expiresAt": now + 960}
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
