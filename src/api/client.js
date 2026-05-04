import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';
import { endpoints } from './endpoints';
import '../lib/cognito';
import { requestNotificationToken } from '../firebase';

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

const NEWS_API_BASE_URL =
  import.meta.env.VITE_NEWS_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://po2hwyb2c6.execute-api.us-east-1.amazonaws.com'
    : '/bbc-api');

export const newsApi = {
  async getLatestNews(lang = 'english') {
    const { data } = await axios.get(`${NEWS_API_BASE_URL}/latest`, {
      params: { lang },
    });

    if (data?.status && data.status !== 200) {
      throw new Error(data?.message || 'Failed to load BBC news.');
    }

    return data;
  },
};

api.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession();

    let token = session?.tokens?.idToken?.toString();

    // 🔥 fallback (VERY IMPORTANT)
    if (!token) {
      token = localStorage.getItem('eduscroll_token');
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      localStorage.setItem('eduscroll_token', token);
    } else {
      console.warn('⚠️ No auth token found');
    }
  } catch (err) {
    console.warn('⚠️ Auth session failed, using fallback');

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
  async getRooms(params = {}) {
    const { data } = await api.get('/rooms', { params });
    return data.rooms || data || [];
  },

  searchUsers: async (q) => {
  const { data } = await api.post('/users/find', {
    action: 'search',
    q,
  });
  return data;
},

inviteUserToRoom: async (roomId, userId) => {
  const { data } = await api.post('/users/find', {
    action: 'invite',
    roomId,
    userId,
  });
  return data;
},

createRoom: async (payload) => {
  const { data } = await api.post('/rooms', payload);
  return data;
},

  async joinRoom(roomId, joinCode = '') {
    const { data } = await api.post(`/rooms/${encodeURIComponent(roomId)}/join`, {
      joinCode,
    });
    return data;
  },

  async getRoomMessages(roomId, params = {}) {
    const { data } = await api.get(
      `/rooms/${encodeURIComponent(roomId)}/messages`,
      { params }
    );
    return data;
  },

  async getRoomMembers(roomId) {
    const { data } = await api.get(
      `/rooms/${encodeURIComponent(roomId)}/members`
    );
    return data.members || data || [];
  },

  async leaveRoom(roomId) {
    const { data } = await api.post(
      `/rooms/${encodeURIComponent(roomId)}/leave`
    );
    return data;
  },

  async requestJoinRoom(roomId) {
  const { data } = await api.post(`/rooms/${encodeURIComponent(roomId)}/request`);
  return data;
},

async getRoomJoinRequests(roomId) {
  const { data } = await api.get(`/rooms/${encodeURIComponent(roomId)}/requests`);
  return data.requests || [];
},

async getHiddenRooms() {
  const { data } = await api.get('/rooms/hidden');
  return data.rooms || [];
},

async unhideRoom(roomId) {
  const { data } = await api.post(
    `/rooms/${encodeURIComponent(roomId)}/unhide`
  );
  return data;
},

async approveRoomJoinRequest(roomId, userId) {
  const { data } = await api.post(
    `/rooms/${encodeURIComponent(roomId)}/requests/approve`,
    { userId }
  );
  return data;
},

  async hideRoom(roomId) {
    const { data } = await api.post(
      `/rooms/${encodeURIComponent(roomId)}/hide`
    );
    return data;
  },

  async deleteRoom(roomId) {
    const { data } = await api.delete(
      `/rooms/${encodeURIComponent(roomId)}`
    );
    return data;
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


export const readBooksApi = {
  async getBooks(params = {}, options = {}) {
    const {
      search = '',
      q = '',
      title = '',
      author = '',
      year = '',
      category = '',
      subject = '',
      page = 1,
      page_size = 12,
      limit,
    } = params;

    const mainSearch = String(search || q || title || '').trim();
    const authorSearch = String(author || '').trim();
    const subjectSearch = String(category || subject || '').trim();
    const yearSearch = String(year || '').trim();

    const queryParams = new URLSearchParams({
      page: String(page),
      limit: String(limit || page_size),
      fields:
  'key,title,author_name,first_publish_year,cover_i,edition_key,has_fulltext,ia,ebook_access,public_scan_b',
    });

    if (mainSearch) {
      queryParams.set('q', mainSearch);
    } else if (subjectSearch) {
      queryParams.set('q', subjectSearch);
    } else {
      queryParams.set('q', 'classic literature');
    }

    if (authorSearch) queryParams.set('author', authorSearch);
    if (subjectSearch) queryParams.set('subject', subjectSearch);
    if (yearSearch) queryParams.set('first_publish_year', yearSearch);

    const { data } = await axios.get(
      `/openlibrary/search.json?${queryParams.toString()}`,
      {
        signal: options.signal,
        timeout: 20000,
      }
    );

    const docs = Array.isArray(data?.docs) ? data.docs : [];

    return docs.map((book) => {
      const workId = book.key?.replace('/works/', '') || '';
      const cover = book.cover_i
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
        : '';
      const editionKey = Array.isArray(book.edition_key) ? book.edition_key[0] : '';
      const iaId = Array.isArray(book.ia) ? book.ia[0] : '';

      return {
        id: workId,
        key: book.key,
        title: book.title || 'Untitled Book',
        authors: book.author_name || [],
        author_name: book.author_name || [],
        author: Array.isArray(book.author_name) && book.author_name.length
          ? book.author_name.join(', ')
          : 'Unknown author',
        first_publish_year: book.first_publish_year || '',
        year: book.first_publish_year || '',
        subjects: book.subject || [],
        subject: book.subject || [],
        cover_i: book.cover_i || null,
        cover,
        coverUrl: cover,
        editionKey,
        ia: iaId,
        hasFullText: Boolean(book.has_fulltext),
        ebookAccess: book.ebook_access || '',
        publicScan: Boolean(book.public_scan_b),
        language: book.language || [],
readable: Boolean(
  iaId &&
  (book.ebook_access === 'public' || book.public_scan_b === true)
),
        openLibraryUrl: workId ? `https://openlibrary.org/works/${workId}` : '',
        previewUrl: workId ? `https://openlibrary.org/works/${workId}` : '',
      };
    });
  },

  async searchBooks(search, params = {}, options = {}) {
    return this.getBooks(
      {
        ...params,
        search,
      },
      options
    );
  },

  async getSubjects(params = {}) {
    const { data } = await api.get('/books/subjects', { params });

    if (typeof data?.body === 'string') {
      try {
        const parsed = JSON.parse(data.body);
        return parsed.subjects || parsed.items || parsed.results || parsed.data || [];
      } catch {
        return [];
      }
    }

    return data.subjects || data.items || data.results || data.data || [];
  },

  async getBookById(id) {
    const bookId = String(id || '').trim();

    if (!bookId) {
      throw new Error('Book ID is missing.');
    }

    const { data } = await axios.get(
      `/openlibrary/works/${encodeURIComponent(bookId)}.json`,
      { timeout: 20000 }
    );

    return data;
  },

  async getTextFromGutenberg(gutenbergId) {
    const bookId = String(gutenbergId || '').trim();

    if (!bookId) {
      throw new Error('Gutenberg book ID is missing.');
    }

    let data;

    try {
      const response = await api.get(`/books/${encodeURIComponent(bookId)}/text`);
      data = response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message ||
          'Readable text is not available for this Gutenberg book.'
      );
    }

    if (typeof data?.body === 'string') {
      try {
        const parsed = JSON.parse(data.body);

        if (!parsed?.success || (!parsed.text && !parsed.content)) {
          throw new Error(parsed?.message || 'Readable text is not available for this book.');
        }

        return parsed.text || parsed.content || '';
      } catch (error) {
        throw new Error(error.message || 'Readable text is not available for this book.');
      }
    }

    if (!data?.success || (!data.text && !data.content)) {
      throw new Error(data?.message || 'Readable text is not available for this book.');
    }

    return data.text || data.content || '';
  },

  async getTextFromInternetArchive(iaId) {
    const archiveId = String(iaId || '').trim();

    if (!archiveId) {
      throw new Error('Internet Archive ID is missing.');
    }

    let data;

    try {
      const response = await api.get(`/books/${encodeURIComponent(archiveId)}/text`);
      data = response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message ||
          'Readable Internet Archive text is not available.'
      );
    }

    if (typeof data?.body === 'string') {
      try {
        const parsed = JSON.parse(data.body);

        if (!parsed?.success || !parsed.text) {
          throw new Error(parsed?.message || 'Readable Internet Archive text is not available.');
        }

        return parsed.text;
      } catch (error) {
        throw new Error(error.message || 'Readable Internet Archive text is not available.');
      }
    }

    if (!data?.success || !data.text) {
      throw new Error(data?.message || 'Readable Internet Archive text is not available.');
    }

    return data.text;
  },

  async getTextFromOpenLibraryWork(workId) {
    const cleanWorkId = String(workId || '').trim();

    if (!cleanWorkId) {
      throw new Error('OpenLibrary work ID is missing.');
    }

    const { data } = await axios.get(
      `/openlibrary/works/${encodeURIComponent(cleanWorkId)}/editions.json?limit=50`,
      { timeout: 20000 }
    );

    const editions = Array.isArray(data?.entries) ? data.entries : [];

    for (const edition of editions) {
      const iaId =
        edition.ocaid ||
        edition.ia?.[0] ||
        edition.identifiers?.ia?.[0] ||
        edition.source_records?.find((record) => String(record).startsWith('ia:'))?.replace('ia:', '') ||
        '';

      if (iaId) {
        try {
          return await this.getTextFromInternetArchive(iaId);
        } catch (error) {
          console.info('Internet Archive source unavailable:', error.message);
        }
      }

      const gutenbergId =
        edition.identifiers?.gutenberg?.[0] ||
        edition.identifiers?.project_gutenberg?.[0] ||
        '';

      if (gutenbergId) {
        try {
          return await this.getTextFromGutenberg(gutenbergId);
        } catch (error) {
          console.info('Gutenberg source unavailable:', error.message);
        }
      }
    }

    throw new Error(
      'Readable text is not available for this OpenLibrary work. View preview on OpenLibrary.'
    );
  },

  async getBookText(id) {
    const bookId = String(id || '').trim();

    if (!bookId) {
      throw new Error('Book ID is missing.');
    }

    if (bookId.startsWith('OL') && bookId.endsWith('W')) {
      return this.getTextFromOpenLibraryWork(bookId);
    }

    if (/^\d+$/.test(bookId)) {
      return this.getTextFromGutenberg(bookId);
    }

    return this.getTextFromInternetArchive(bookId);
  },
};

export const postApi = {
async getFeed({ limit = 10, cursor = null, topic = null } = {}) {
  if (USE_MOCK) {
    await delay(300);
    return {
      items: mockFeed.slice(0, limit),
      nextCursor: null,
      count: mockFeed.length,
    };
  }

  const { data } = await api.get(endpoints.posts.feed, {
    params: {
      limit,
      ...(cursor ? { cursor } : {}),
      ...(topic ? { topic } : {}),
    },
  });

  return {
    items: normalizeList(data),
    nextCursor: data?.nextCursor || null,
    count: data?.count || 0,
  };
},

  async getCreatorPrivatePosts(userId) {
  const { data } = await api.get('/creator/private-posts', {
    params: { userId },
  });

  return data.posts || data.items || [];
},
async translatePost(payload) {
  const { data } = await api.post('/posts/translate', payload);
  return data;
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

async explainPost(payload) {
  const { data } = await api.post('/posts/explain', payload);
  return data;
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

savePushToken: async (token) => {
  const res = await api.post('/users/push-token', {
    token,
    platform: 'web',
  });

  return res.data;
},
};



export const chatApi = {
  async searchUsers(query) {
    const { data } = await api.get(endpoints.chat.searchUsers, {
      params: { query },
    });

    return normalizeList(data);
  },

blockUser: async (blockedId) => {
  const res = await api.post('/users/block', { blockedId });
  return res.data;
},

unblockUser: async (blockedId) => {
  const res = await api.post('/users/unblock', { blockedId });
  return res.data;
},
checkBlockStatus: async (userId) => {
  const res = await api.get(`/users/block-status?userId=${encodeURIComponent(userId)}`);
  return res.data;
},

markAsRead: async (chatId) => {
  return { markedRead: true, chatId };
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

export const notificationApi = {
  async initPush(user) {
    const userId = user?.id || user?.userId || user?.sub;

    if (!userId) return null;

    try {
      await delay(1500);

      const token = await requestNotificationToken();

      if (!token) return null;

      await userApi.savePushToken(token);

      console.log('✅ Push token saved:', token);
      return token;
    } catch (err) {
      console.error('❌ Push notification setup failed:', err);
      return null;
    }
  }
};

export default api;