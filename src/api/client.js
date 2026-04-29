import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';
import { endpoints } from './endpoints';
import '../lib/cognito';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const mockFeed = [];
const mockUser = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession();

    const token =
      session?.tokens?.idToken?.toString() ||
      session?.tokens?.accessToken?.toString();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      localStorage.setItem('eduscroll_token', token);
    }
  } catch {
    const token = localStorage.getItem('eduscroll_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;

  if (typeof data?.body === 'string') {
    try {
      return normalizeList(JSON.parse(data.body));
    } catch {
      return [];
    }
  }

  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.reels)) return data.reels;
  if (Array.isArray(data?.posts)) return data.posts;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.savedReels)) return data.savedReels;
  if (Array.isArray(data?.comments)) return data.comments;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.chats)) return data.chats;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.rooms)) return data.rooms;

  return [];
};

export const authApi = {
  async login() {
    throw new Error('Login is handled by Cognito, not API Gateway.');
  },

  async register() {
    throw new Error('Register is handled by Cognito, not API Gateway.');
  },
};

export const roomApi = {
  async getRooms() {
    const { data } = await api.get(endpoints.rooms.list);
    return data.rooms || data.items || [];
  },

  async createRoom(payload) {
    const { data } = await api.post(endpoints.rooms.create, payload);
    return data.room || data;
  },

  async joinRoom(roomId) {
    const { data } = await api.post(endpoints.rooms.join, { roomId });
    return data;
  },

  async getRoomMessages(roomId) {
    const { data } = await api.get(endpoints.rooms.messages, {
      params: { roomId },
    });

    return data.messages || data.items || [];
  },
};

export const creatorApi = {
  async getProfile(userId) {
    const { data } = await api.get(endpoints.creator.profile, {
      params: { userId },
    });

    return data.profile || data;
  },

async getFollowRequests() {
  const { data } = await api.get(endpoints.creator.followRequests);
  return data.requests || data.items || [];
},

async approveFollowRequest(followerId) {
  const { data } = await api.post(endpoints.creator.approveRequest, {
    followerId,
  });

  return data;
},

async rejectFollowRequest(followerId) {
  const { data } = await api.post(endpoints.creator.rejectRequest, {
    followerId,
  });

  return data;
},

  async follow(userId) {
    const { data } = await api.post(endpoints.creator.follow, {
      followingId: userId,
    });

    return data;
  },

  async unfollow(userId) {
    const { data } = await api.post(endpoints.creator.unfollow, {
      followingId: userId,
    });

    return data;
  },

  async getFollowers(userId) {
    const { data } = await api.get(endpoints.creator.followers, {
      params: { userId },
    });

    return data.followers || data.items || [];
  },

  async getFollowing(userId) {
    const { data } = await api.get(endpoints.creator.following, {
      params: { userId },
    });

    return data.following || data.items || [];
  },
};

export const postApi = {
  async getFeed() {
    if (USE_MOCK) {
      await delay(300);
      return mockFeed;
    }

    const { data } = await api.get(endpoints.posts.feed);
    return normalizeList(data);
  },

  async getCreatorPrivatePosts(userId) {
  const { data } = await api.get('/creator/private-posts', {
    params: { userId },
  });

  return data.posts || data.items || [];
},

async deleteComment(payload) {
  try {
    const { data } = await api.post('/comments/delete', payload);
    return data;
  } catch (err) {
    console.error('DELETE COMMENT API ERROR:', err.response?.data || err);
    throw err;
  }
},

async editComment(payload) {
  try {
    const { data } = await api.put('/comments/edit', payload);
    return data.comment || data;
  } catch (err) {
    console.error('EDIT COMMENT API ERROR:', err.response?.data || err);
    throw err;
  }
},

  async getPostsByCreator(userId) {
    if (USE_MOCK) {
      await delay(250);
      return mockFeed.filter(
        (post) =>
          post.authorId === userId ||
          post.userId === userId ||
          post.creatorId === userId
      );
    }

    const { data } = await api.get(endpoints.posts.feed);
    const posts = normalizeList(data);

    return posts.filter(
      (post) =>
        post.authorId === userId ||
        post.userId === userId ||
        post.creatorId === userId
    );
  },

  async createPost(payload) {
    if (USE_MOCK) {
      await delay(400);
      return {
        success: true,
        item: {
          id: crypto.randomUUID(),
          ...payload,
        },
      };
    }

    const { data } = await api.post(endpoints.posts.create, payload);
    return data;
  },

  async updatePost(payload) {
    if (USE_MOCK) {
      await delay(300);
      return { success: true };
    }

    const { data } = await api.post(endpoints.posts.update, payload);
    return data;
  },

async deletePost(reelId) {
  const { data } = await api.post(endpoints.posts.delete, {
    id: reelId,
    reelId,
  });

  return data;
},



  async toggleSave(reelId) {
    if (USE_MOCK) {
      await delay(200);
      return { success: true };
    }

    const { data } = await api.post(endpoints.posts.save, {
      reelId,
      id: reelId,
      postId: reelId,
    });

    return data;
  },

  async getMyReels() {
    if (USE_MOCK) {
      await delay(300);
      return mockFeed;
    }

    const { data } = await api.get(endpoints.posts.mine);
    return normalizeList(data);
  },

  async toggleLike(reelId) {
  const { data } = await api.post(endpoints.posts.like, {
    reelId,
    id: reelId,
    postId: reelId,
  });

  return data;
},

async toggleSave(reelId) {
  const { data } = await api.post(endpoints.posts.save, {
    reelId,
    id: reelId,
    postId: reelId,
  });

  return data;
},

  

  async getSavedReels() {
    if (USE_MOCK) {
      await delay(250);
      return mockFeed.filter((item) => item.saved);
    }

    const { data } = await api.get(endpoints.posts.saved);
    return normalizeList(data);
  },

  async getTopics() {
    if (USE_MOCK) {
      await delay(200);
      return [];
    }

    const { data } = await api.get(endpoints.topics.all);
    return normalizeList(data);
  },

  async getComments(reelId) {
    if (USE_MOCK) {
      await delay(200);
      return [];
    }

    const { data } = await api.get(endpoints.posts.comments, {
      params: {
        reelId,
        id: reelId,
        postId: reelId,
      },
    });

    return normalizeList(data);
  },

  async addComment(payload) {
    if (USE_MOCK) {
      await delay(200);
      return { success: true };
    }

    const reelId = payload.reelId || payload.id || payload.postId;
    const text = payload.comment || payload.text || payload.body;

    const { data } = await api.post(endpoints.posts.addComment, {
      reelId,
      id: reelId,
      postId: reelId,
      comment: text,
      text,
      body: text,
    });

    return data;
  },

  async getUploadUrl(payload) {
    if (USE_MOCK) {
      await delay(200);
      return {
        uploadUrl: '',
        fileUrl: '',
      };
    }

    const { data } = await api.post(endpoints.posts.uploadUrl, payload);
    return data;
  },
  
async getSingleReel(reelId) {
  if (USE_MOCK) {
    await delay(200);
    return null;
  }

  const { data } = await api.get(endpoints.posts.single, {
    params: {
      id: reelId,
      reelId,
      postId: reelId,
    },
  });

  return data?.item ?? data?.reel ?? data;
},
};

export const userApi = {
  getMe: async () => {
  const res = await api.get('/users/profile');
  return res.data.profile || res.data;
},

  updateProfile: async (payload) => {
  const res = await api.put('/users/profile', payload);
  return res.data.profile || res.data;
},
};

export const chatApi = {
  async searchUsers(query) {
    const { data } = await api.get(endpoints.chat.searchUsers, {
      params: { query },
    });

    return normalizeList(data);
  },

  async blockUser(userId) {
  const { data } = await api.post('/users/block', {
    blockedId: userId,
    userId,
  });

  return data;
},

async reportUser(payload) {
  const { data } = await api.post('/users/report', {
    reportedUserId: payload.reportedUserId,
    chatId: payload.chatId,
    reason: payload.reason,
  });

  return data;
},

  async startChat(user) {
    const { data } = await api.post(endpoints.chat.start, {
      receiverId: user.userId || user.id || user.sub,
      receiverEmail: user.email,
      receiverUsername: user.username,
    });

    return data;
  },

  async getChats() {
    const { data } = await api.get(endpoints.chat.list);
    return normalizeList(data);
  },

  async getMessages(chatId) {
    const { data } = await api.get(endpoints.chat.messages, {
      params: { chatId },
    });

    return normalizeList(data);
  },

  async sendMessage({ chatId, receiverId, text }) {
    const { data } = await api.post(endpoints.chat.send, {
      chatId,
      receiverId,
      text,
    });

    return data;
  },
};

export default api;