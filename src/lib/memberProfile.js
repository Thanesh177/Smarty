export function normalizeMemberId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const id = String(value).trim();
  if (!id || id.length > 160 || /[@\x00-\x1f\x7f]/.test(id)
    || /^(?:\.{1,2}|null|undefined|none|unknown|smarty-ai)$/i.test(id)) return '';
  return id;
}

const firstId = (...values) => values.map(normalizeMemberId).find(Boolean) || '';

export function getMemberId(person) {
  return firstId(person?.userId, person?.sub, person?.user_id, person?.id, person?.profileId);
}

export function memberProfilePath(userId) {
  const id = normalizeMemberId(userId);
  return id ? '/creator/' + encodeURIComponent(id) : '';
}

export function getPublicMemberName(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const name = value.trim();
    if (!name || /^(?:null|undefined|none|unknown|user|creator|post)$/i.test(name)
      || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(name)
      || (name.includes('@') && !/^@[\w.-]+$/.test(name))) continue;
    return name.slice(0, 80);
  }
  return '';
}

export function getMessageAuthorId(message) {
  return firstId(message?.senderId, message?.senderUserId, message?.senderSub, message?.authorId,
    message?.authorSub, message?.userId, message?.user_id, getMemberId(message?.sender),
    getMemberId(message?.author), getMemberId(message?.user));
}

export function getConversationPartnerId(chat, viewerId) {
  const viewerIds = new Set((typeof viewerId === 'object'
    ? [viewerId?.userId, viewerId?.id, viewerId?.sub]
    : [viewerId]).map(normalizeMemberId).filter(Boolean));
  if (!viewerIds.size || !chat) return '';
  const candidates = [
    chat.otherUserId, chat.partnerId, getMemberId(chat.otherUser), getMemberId(chat.partner),
    chat.receiverUserId, chat.receiverId, getMemberId(chat.receiver),
    chat.participantId, getMemberId(chat.participant), chat.senderUserId, chat.senderId, getMemberId(chat.sender),
    ...[chat.participants, chat.members, chat.users, chat.userIds].flatMap(list =>
      Array.isArray(list) ? list.map(item => typeof item === 'object' ? getMemberId(item) : item) : []),
  ];
  // The chat's userId may be the viewer's membership key. Its id is a
  // conversation ID, not a member ID. Neither is a safe fallback.
  return candidates.map(normalizeMemberId).find(id => id && !viewerIds.has(id)) || '';
}

export function requireMatchingProfile(profile, userId) {
  const target = normalizeMemberId(userId);
  if (!target || getMemberId(profile) !== target) {
    const error = new Error('The server did not return the requested member profile.');
    error.code = 'PROFILE_IDENTITY_MISMATCH';
    throw error;
  }
  return profile;
}
