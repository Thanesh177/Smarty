import boto3
import time
import firebase_admin
from firebase_admin import credentials, messaging
from boto3.dynamodb.conditions import Key
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")

users_table = dynamodb.Table("SmartyUsers")
push_tokens_table = dynamodb.Table("UserPushTokens")

cred = credentials.Certificate("firebase-service-account.json")
firebase_admin.initialize_app(cred)

def to_int(value):
    if isinstance(value, Decimal):
        return int(value)
    return int(value or 0)

def lambda_handler(event, context):
    now = int(time.time() * 1000)
    one_day_ago = now - (24 * 60 * 60 * 1000)

    users = users_table.scan().get("Items", [])
    sent = 0

    for user in users:
        user_id = user.get("userId")
        last_seen = to_int(user.get("lastSeenAt", 0))

        if not user_id:
            continue

        if last_seen > one_day_ago:
            continue

        token_result = push_tokens_table.query(
            KeyConditionExpression=Key("userId").eq(user_id)
        )

        tokens = [item["token"] for item in token_result.get("Items", [])]

        for token in tokens:
            message = messaging.Message(
                notification=messaging.Notification(
                    title="Come back to Smarty 👋",
                    body="Continue learning while you scroll.",
                ),
                token=token,
            )

            try:
                messaging.send(message)
                sent += 1
            except Exception as e:
                print("Push send failed:", str(e))

    return {
        "statusCode": 200,
        "body": f"Sent {sent} push notifications"
    }