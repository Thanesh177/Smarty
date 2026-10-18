export const hasNativeDownloads = () => typeof window !== 'undefined' && typeof window.__SMARTY_OFFLINE_REQUEST__ === 'function';

export function requestNativeDownload(payload) {
  if (!hasNativeDownloads()) return Promise.reject(new Error('Update the iPhone/iPad app to use on-device downloads.'));
  return window.__SMARTY_OFFLINE_REQUEST__(payload);
}

export function mediaDownloadPayload(message, source) {
  const url = String(source || message.mediaUrl || message.fileUrl || '');
  let parsed; try { parsed = new URL(url, window.location.origin); } catch { throw new Error('Reopen this attachment to refresh its download link.'); }
  if (parsed.protocol !== 'https:') throw new Error('Wait for this attachment to finish uploading, then try again.');
  const type = String(message.mediaType || message.mimeType || '').toLowerCase();
  const name = String(message.mediaName || message.fileName || 'Shared media').slice(0, 200);
  const kind = type.includes('video') ? 'video' : type.includes('image') ? 'image' : type.includes('audio') ? 'audio' : 'document';
  return {kind, title: name, sourceId: String(message.mediaKey || message.messageId || message.id || parsed.pathname).slice(0, 500), url: parsed.href};
}

// Selected fields only: never copy signed URLs or account/API records.
export function chatBackupPayload({id, title, messages, userId}) {
  if (!id || !messages?.length) throw new Error('Load some messages before creating a backup.');
  if (messages.length > 2000) throw new Error('This conversation has too many loaded messages for one on-device snapshot.');
  const rows = messages.filter(message => !message.viewOnce && !message.isViewOnce && !message.ephemeral).map(message => {
    const deleted = Boolean(message.isDeleted || message.deleted);
    const own = message.isMine || String(message.senderId || message.userId || '') === String(userId || '');
    const name = own ? 'You' : String(message.senderName || message.senderUsername || 'Member');
    const rawDate = message.createdAt || message.timestamp || message.sentAt;
    const date = new Date(typeof rawDate === 'number' && rawDate < 1e12 ? rawDate * 1000 : rawDate);
    return {sender: name.includes('@') ? 'Member' : name.slice(0, 80), text: deleted ? 'Message removed' : String(message.text || message.message || message.content || ''),
      date: Number.isFinite(date.getTime()) ? date.toISOString() : '',
      attachment: deleted ? '' : String(message.mediaName || message.fileName || (message.mediaKey || message.mediaUrl || message.fileUrl ? 'Attachment (not included)' : '')).slice(0, 150)};
  });
  if (!rows.length) throw new Error('There are no messages eligible for a backup.');
  if (rows.some(row => new TextEncoder().encode(row.text).length > 16000)) throw new Error('A message is too large for an on-device snapshot.');
  return {kind: 'chat', sourceId: String(id).slice(0, 500), title: String(title || 'Conversation backup').slice(0, 200), messages: rows};
}
