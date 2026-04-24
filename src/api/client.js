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
    const token = session?.tokens?.idToken?.toString();

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
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.reels)) return data.reels;
  if (Array.isArray(data?.savedReels)) return data.savedReels;
  if (Array.isArray(data?.body)) return data.body;

  if (typeof data?.body === 'string') {
    try {
      const parsed = JSON.parse(data.body);
      return normalizeList(parsed);
    } catch {
      return [];
    }
  }

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

export const postApi = {
  async getFeed() {
    if (USE_MOCK) {
      await delay(300);
      return mockFeed;
    }

    const { data } = await api.get(endpoints.posts.feed);
    return normalizeList(data);
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
    if (USE_MOCK) {
      await delay(200);
      return { success: true };
    }

    const { data } = await api.post(endpoints.posts.delete, { reelId });
    return data;
  },

  async toggleLike(reelId) {
    if (USE_MOCK) {
      await delay(200);
      return { success: true };
    }

    const { data } = await api.post(endpoints.posts.like, { reelId });
    return data;
  },

  async toggleSave(reelId) {
    if (USE_MOCK) {
      await delay(200);
      return { success: true };
    }

    const { data } = await api.post(endpoints.posts.save, { reelId });
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
      params: { reelId },
    });

    return normalizeList(data);
  },

  async addComment(payload) {
    if (USE_MOCK) {
      await delay(200);
      return { success: true };
    }

    const { data } = await api.post(endpoints.posts.addComment, payload);
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
      params: { reelId },
    });

    return data?.item ?? data?.reel ?? data;
  },
};

export const userApi = {
  async getMe() {
    return JSON.parse(localStorage.getItem('eduscroll_user')) || mockUser;
  },

  async getSaved() {
    if (USE_MOCK) {
      await delay(250);
      return Array.isArray(mockFeed)
        ? mockFeed.filter((item) => item.saved)
        : [];
    }

    const { data } = await api.get(endpoints.posts.saved);
    return normalizeList(data);
  },
};

export default api;