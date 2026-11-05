export function normalizeChatDeletion(value, chatId, status = 200) {
  let body = value;
  for (let depth = 0; depth < 3; depth++) {
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { break; } }
    else if (typeof body?.body === 'string' || (body?.body && typeof body.body === 'object')) body = body.body;
    else break;
  }
  if (status === 404 && body?.error === 'Chat not found' && body?.deleted === false
    && (!body.chatId || String(body.chatId) === chatId)) return { deleted: true, chatId, alreadyDeleted: true };
  if (status >= 400 || body?.success === false || body?.deleted === false
    || (body?.deleted !== true && body?.success !== true)
    || (body.chatId && String(body.chatId) !== chatId)) throw new Error('The conversation could not be deleted. Please try again.');
  return { ...body, deleted: true, chatId };
}
