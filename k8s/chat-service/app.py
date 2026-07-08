import os
import json
import boto3
import redis
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

app = FastAPI(title="Smarty Chat Service")

dynamodb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1"))
s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION", "us-east-1"))

CHAT_MESSAGES_TABLE = os.getenv("CHAT_MESSAGES_TABLE", "ChatMessages")
SMARTY_CHATS_TABLE = os.getenv("SMARTY_CHATS_TABLE", "SmartyChats")
CHAT_MEDIA_BUCKET = os.getenv("CHAT_MEDIA_BUCKET", "smarty-chat-media")

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    decode_responses=True
)

class SendMessageRequest(BaseModel):
    chatId: str
    senderId: str
    message: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chats/message")
def send_message(payload: SendMessageRequest):
    table = dynamodb.Table(CHAT_MESSAGES_TABLE)

    import time, uuid
    message_id = str(uuid.uuid4())
    created_at = int(time.time() * 1000)

    item = {
        "chatId": payload.chatId,
        "messageId": message_id,
        "senderId": payload.senderId,
        "message": payload.message,
        "createdAt": created_at
    }

    table.put_item(Item=item)

    redis_client.publish(
        f"chat:{payload.chatId}",
        json.dumps(item)
    )

    return {
        "ok": True,
        "message": item
    }

@app.get("/chats/messages")
def get_messages(chatId: str):
    table = dynamodb.Table(CHAT_MESSAGES_TABLE)

    response = table.query(
        KeyConditionExpression="chatId = :chatId",
        ExpressionAttributeValues={":chatId": chatId}
    )

    return {
        "messages": response.get("Items", [])
    }

@app.post("/media/upload-url")
def get_upload_url(chatId: str, filename: str):
    key = f"chat/{chatId}/{filename}"

    url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": CHAT_MEDIA_BUCKET,
            "Key": key
        },
        ExpiresIn=300
    )

    return {
        "uploadUrl": url,
        "key": key
    }