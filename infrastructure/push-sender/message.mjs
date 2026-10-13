import { createHash } from 'node:crypto';

function text(value, bytes) {
  let result = String(value || '');
  while (Buffer.byteLength(result) > bytes) result = result.slice(0, -1);
  return result;
}

export function notificationPath(data = {}) {
  if (data.chatId) return `/chat?chatId=${encodeURIComponent(data.chatId)}&senderId=${encodeURIComponent(data.senderId || '')}`;
  const path = String(data.url || '/notifications');
  return path.startsWith('/') && !path.startsWith('//') && !/[\\\r\n]/.test(path) && path.length <= 2000 ? path : '/notifications';
}

export function buildMessage(device, payload, origin = 'https://smarty.wiki') {
  const data = payload.data || {};
  const path = notificationPath(data);
  const title = text(payload.title, 180), body = text(payload.body, 900);
  const id = text(data.notificationId, 200);
  const message = {
    token: device.token,
    data: { title, body, url: path, userId: String(payload.userId), type: text(data.type || 'chat', 40),
      notificationId: id, chatId: text(data.chatId, 150), senderId: text(data.senderId, 150), roomId: text(data.roomId, 150) },
    android: { priority: data.type === 'news' ? 'NORMAL' : 'HIGH' },
    webpush: { headers: { Urgency: data.type === 'news' ? 'normal' : 'high' }, fcmOptions: { link: new URL(path, origin).href } },
  };
  if (device.platform === 'ios') {
    message.apns = { headers: { 'apns-push-type': 'alert', 'apns-priority': '10',
      ...(id ? { 'apns-collapse-id': createHash('sha256').update(id).digest('hex') } : {}) },
      payload: { aps: { alert: { title, body }, sound: 'default' } } };
  }
  return { message };
}

export function unregistered(error) {
  return error?.error?.details?.some(item => item['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError' && item.errorCode === 'UNREGISTERED') === true;
}

export function receiptId(notificationId, deviceToken) {
  return 'push-receipt#' + createHash('sha256').update(`${notificationId}\0${deviceToken}`).digest('hex');
}
