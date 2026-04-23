import axios from 'axios';
import { endpoints } from './endpoints';
import { mockFeed, mockUser } from './mockData';
import { fetchAuthSession } from 'aws-amplify/auth';
import '../lib/cognito';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

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

export const authApi = {
  async login(payload) {
    if (USE_MOCK) {
      await delay(400);
      return {
        token: 'mock-token',
        user: { ...mockUser, email: payload.email },
      };
    }
    const { data } = await api.post(endpoints.auth.login, payload);
    return data;
  },
  async register(payload) {
    if (USE_MOCK) {
      await delay(400);
      return {
        token: 'mock-token',
        user: { ...mockUser, name: payload.name, email: payload.email },
      };
    }
    const { data } = await api.post(endpoints.auth.register, payload);
    return data;
  },
};

export const postApi = {
  async getFeed() {
    if (USE_MOCK) {
      await delay(300);
      return mockFeed;
    }
    const { data } = await api.get(endpoints.posts.feed);
    return data.items ?? data;
  },
  async createPost(payload) {
    if (USE_MOCK) {
      await delay(400);
      return { success: true, item: { id: crypto.randomUUID(), ...payload } };
    }
    const { data } = await api.post(endpoints.posts.create, payload);
    return data;
  },
  async toggleLike(postId) {
    if (USE_MOCK) {
      await delay(200);
      return { success: true };
    }
    const { data } = await api.post(endpoints.posts.like(postId));
    return data;
  },
  async toggleSave(postId) {
    if (USE_MOCK) {
      await delay(200);
      return { success: true };
    }
    const { data } = await api.post(endpoints.posts.save(postId));
    return data;
  },
};

export const userApi = {
  async getMe() {
    if (USE_MOCK) {
      await delay(250);
      return mockUser;
    }
    const { data } = await api.get(endpoints.users.me);
    return data;
  },
  async getSaved() {
    if (USE_MOCK) {
      await delay(250);
      return mockFeed.filter((item) => item.saved);
    }
    const { data } = await api.get(endpoints.users.saved);
    return data.items ?? data;
  },
};
