export const endpoints = {
  posts: {
    feed: '/reels',
    create: '/createReel',
    delete: '/deleteReel',
    update: '/updateReel',
    like: '/like',
    save: '/saveReel',
    single: '/reel',
    mine: '/myReels',
    saved: '/savedReels',
    uploadUrl: '/getUploadUrl',
    comments: '/comments',
    addComment: '/comment',
  },

  topics: {
    all: '/topics',
  },

  rooms: {
    list: '/rooms',
    create: '/rooms/create',
    join: '/rooms/join',
    messages: '/rooms/messages',

    // Room invite system
    invites: '/rooms/invites',
    sendInvite: (roomId) => `/rooms/${roomId}/invites`,
    acceptInvite: (roomId) => `/rooms/${roomId}/invites/accept`,
    rejectInvite: (roomId) => `/rooms/${roomId}/invites/reject`,

    // Invite links
    createInviteLink: '/rooms/invite-link',
    invitePreview: (inviteCode) => `/room-invites/${inviteCode}`,
    joinFromInvite: (inviteCode) => `/room-invites/${inviteCode}/join`,
    disableInviteLink: (inviteCode) => `/room-invites/${inviteCode}/disable`,

    // Join requests
    joinRequests: (roomId) => `/rooms/${roomId}/requests`,
    approveJoinRequest: (roomId) => `/rooms/${roomId}/requests/approve`,
    rejectJoinRequest: (roomId) => `/rooms/${roomId}/requests/reject`,
  },

  chat: {
    searchUsers: '/users/search',
    start: '/chats/start',
    list: '/chats',
    messages: '/chats/messages',
    send: '/chats/message',
  },

  creator: {
    profile: '/users/profile',
    follow: '/users/follow',
    unfollow: '/users/unfollow',
    followers: '/users/followers',
    following: '/users/following',
    followRequests: '/users/follow-requests',
    approveRequest: '/users/follow-requests/approve',
    rejectRequest: '/users/follow-requests/reject',
  },
};