import { GoogleAuth } from 'google-auth-library';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, paginateQuery } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { buildMessage, receiptId, unregistered } from './message.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 2 }));
const tokensTable = process.env.TOKENS_TABLE || 'UserPushTokens';
const project = process.env.FIREBASE_PROJECT_ID || 'smarty-c17cf';
let auth;
function response(statusCode, body) { return { statusCode, body: JSON.stringify(body) }; }

async function accessToken() {
  // Preserve the already-installed sender credential. Never return it in a
  // response, log it or copy it into source or deployment parameters.
  auth ||= new GoogleAuth({ credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'),
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
  const result = await (await auth.getClient()).getAccessToken();
  const value = typeof result === 'string' ? result : result?.token;
  if (!value) throw new Error('Provider authentication unavailable');
  return value;
}

async function claim(table, userId, id, now) {
  const key = { userId, entryId: id };
  const { Item } = await db.send(new GetCommand({ TableName: table, Key: key, ConsistentRead: true }));
  if (Item?.state === 'sent') return { done: true };
  const owner = randomUUID();
  try {
    await db.send(new PutCommand({ TableName: table,
      Item: { ...key, state: 'sending', owner, leaseUntil: now + 120, expiresAt: now + 90 * 86400 },
      ConditionExpression: 'attribute_not_exists(entryId) OR (#state <> :sent AND leaseUntil <= :now)',
      ExpressionAttributeNames: { '#state': 'state' }, ExpressionAttributeValues: { ':sent': 'sent', ':now': now } }));
    return { owner, key };
  } catch (error) { if (error.name === 'ConditionalCheckFailedException') return { busy: true }; throw error; }
}

export async function handler(payload, context) {
  // Only existing IAM-authorized backend functions may invoke this sender.
  // Never accept an unauthenticated HTTP request naming another recipient.
  if (payload?.requestContext || payload?.httpMethod) return response(403, { error: 'Private delivery service' });
  if (!payload || typeof payload.userId !== 'string' || payload.userId.length > 200 || !payload.userId ||
      typeof payload.title !== 'string' || typeof payload.body !== 'string') return response(400, { error: 'Invalid delivery request' });
  const devices = [];
  for await (const page of paginateQuery({ client: db }, { TableName: tokensTable,
    KeyConditionExpression: 'userId = :user', ExpressionAttributeValues: { ':user': payload.userId },
    ProjectionExpression: '#token, platform', ExpressionAttributeNames: { '#token': 'token' } })) {
    devices.push(...(page.Items || []).filter(device => !payload.targetPlatform || device.platform === payload.targetPlatform));
  }
  const counts = { sent: 0, failed: 0, removed: 0, deduplicated: 0, totalTokens: devices.length };
  if (!devices.length) return response(200, counts);
  const table = payload.data?.type === 'news' && payload.data?.notificationId && payload.data?.receiptTable;
  // Table access is restricted to the exact private-news table by IAM.
  if (table) {
    const { Item } = await db.send(new GetCommand({ TableName: table,
      Key: { userId: payload.userId, entryId: 'push-preferences' }, ConsistentRead: true }));
    if (Item?.pushPreferences?.enabled !== true || Item?.pushPreferences?.news !== true) return response(200, { ...counts, skipped: true });
    if (Item.pushPreferences.previews === false) payload = { ...payload, body: 'New reporting is available in a story you follow.' };
  }
  const bearer = await accessToken();
  const now = Math.floor(Date.now() / 1000);
  for (const device of devices) {
    if (!device.token) continue;
    if (context && context.getRemainingTimeInMillis() < 12000) { counts.failed++; continue; }
    let receipt;
    try {
      if (table) {
        receipt = await claim(table, payload.userId, receiptId(payload.data.notificationId, device.token), now);
        if (receipt.done) { counts.deduplicated++; continue; }
        if (receipt.busy) { counts.failed++; continue; }
      }
      const result = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
        method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildMessage(device, payload)), signal: AbortSignal.timeout(8000) });
      const provider = await result.json().catch(() => ({}));
      if (!result.ok) {
        if (unregistered(provider)) {
          await db.send(new DeleteCommand({ TableName: tokensTable, Key: { userId: payload.userId, token: device.token } }));
          counts.removed++;
        } else counts.failed++;
        if (receipt?.owner) await db.send(new UpdateCommand({ TableName: table, Key: receipt.key,
          UpdateExpression: 'SET leaseUntil = :now', ConditionExpression: 'owner = :owner',
          ExpressionAttributeValues: { ':now': now, ':owner': receipt.owner } }));
        console.warn(JSON.stringify({ event: 'push_provider_error', status: result.status, unregistered: unregistered(provider) }));
        continue;
      }
      if (receipt?.owner) await db.send(new UpdateCommand({ TableName: table, Key: receipt.key,
        UpdateExpression: 'SET #state = :sent REMOVE leaseUntil, owner', ConditionExpression: 'owner = :owner',
        ExpressionAttributeNames: { '#state': 'state' }, ExpressionAttributeValues: { ':sent': 'sent', ':owner': receipt.owner } }));
      counts.sent++;
    } catch (error) {
      counts.failed++;
      console.warn(JSON.stringify({ event: 'push_delivery_retry', errorType: error.name || 'Error' }));
    }
  }
  console.info(JSON.stringify({ event: 'push_delivery_batch', ...counts }));
  return response(200, counts);
}
