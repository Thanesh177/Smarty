import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';
import { endpoints } from './endpoints';
import '../lib/cognito';
import { requestNotificationToken } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT || 20000);
const AUTH_TOKEN_CACHE_MS = 45 * 1000;

let cachedAuthToken = '';
let cachedAuthTokenAt = 0;
let pendingAuthTokenPromise = null;

const mockFeed = [];
const mockUser = null;
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

const NEWS_API_BASE_URL =
  import.meta.env.VITE_NEWS_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://po2hwyb2c6.execute-api.us-east-1.amazonaws.com'
    : '/bbc-api');

const OPENLIBRARY_BASE_URL =
  import.meta.env.VITE_OPENLIBRARY_BASE_URL || 'https://openlibrary.org';

const getStoredToken = () => {
  try {
    return localStorage.getItem('eduscroll_token') || '';
  } catch {
    return '';
  }
};

const setStoredToken = (token) => {
  try {
    if (token) localStorage.setItem('eduscroll_token', token);
  } catch {
    // Ignore private browsing/storage failures.
  }
};

const getAuthToken = async () => {
  const now = Date.now();

  if (cachedAuthToken && now - cachedAuthTokenAt < AUTH_TOKEN_CACHE_MS) {
    return cachedAuthToken;
  }

  if (pendingAuthTokenPromise) {
    return pendingAuthTokenPromise;
  }

  pendingAuthTokenPromise = (async () => {
    try {
      const session = await fetchAuthSession();
      const token = session?.tokens?.idToken?.toString() || getStoredToken();

      if (token) {
        cachedAuthToken = token;
        cachedAuthTokenAt = Date.now();
        setStoredToken(token);
      }

      return token;
    } catch {
      const token = getStoredToken();

      if (token) {
        cachedAuthToken = token;
        cachedAuthTokenAt = Date.now();
      }

      return token;
    } finally {
      pendingAuthTokenPromise = null;
    }
  })();

  return pendingAuthTokenPromise;
};

export const newsApi = {
  async getLatestNews(lang = 'english') {
    const { data } = await axios.get(`${NEWS_API_BASE_URL}/latest`, {
      params: { lang },
      timeout: API_TIMEOUT,
    });

    if (data?.status && data.status !== 200) {
      throw new Error(data?.message || 'Failed to load BBC news.');
    }

    return data;
  },
};

api.interceptors.request.use(async (config) => {
  const token = await getAuthToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (import.meta.env.DEV) {
    console.warn('⚠️ No auth token found');
  }

  return config;
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeList = (data) => {
  const parsed = parseApiBody(data);

  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed?.reels)) return parsed.reels;
  if (Array.isArray(parsed?.posts)) return parsed.posts;
  if (Array.isArray(parsed?.data)) return parsed.data;
  if (Array.isArray(parsed?.savedReels)) return parsed.savedReels;
  if (Array.isArray(parsed?.comments)) return parsed.comments;
  if (Array.isArray(parsed?.users)) return parsed.users;
  if (Array.isArray(parsed?.chats)) return parsed.chats;
  if (Array.isArray(parsed?.messages)) return parsed.messages;
  if (Array.isArray(parsed?.rooms)) return parsed.rooms;

  return [];
};

const parseApiBody = (data) => {
  if (typeof data?.body !== 'string') return data;

  try {
    return JSON.parse(data.body);
  } catch {
    return data;
  }
};


const encodePathSegment = (value) => encodeURIComponent(String(value || '').trim());

const getProfileImageUrl = (item = {}) =>
  String(
    item.photoUrl ||
      item.photoURL ||
      item.profilePic ||
      item.profilePictureUrl ||
      item.profilePicture ||
      item.avatarUrl ||
      item.avatar ||
      item.picture ||
      item.imageUrl ||
      item.receiverPhotoUrl ||
      item.receiverPhotoURL ||
      item.receiverProfilePic ||
      item.receiverProfilePictureUrl ||
      item.receiverProfilePicture ||
      item.receiverAvatarUrl ||
      item.receiverAvatar ||
      item.receiverPhoto ||
      item.receiverImageUrl ||
      item.receiverImage ||
      ''
  ).trim();

const getReceiverProfileImageUrl = (item = {}) =>
  String(
    item.receiverPhotoUrl ||
      item.receiverPhotoURL ||
      item.receiverAvatarUrl ||
      item.receiverProfilePictureUrl ||
      item.receiverProfilePicture ||
      item.receiverProfilePic ||
      item.receiverAvatar ||
      item.receiverPhoto ||
      item.receiverImageUrl ||
      item.receiverImage ||
      item.receiver?.photoUrl ||
      item.receiver?.photoURL ||
      item.receiver?.profilePic ||
      item.receiver?.profilePictureUrl ||
      item.receiver?.profilePicture ||
      item.receiver?.avatarUrl ||
      ''
  ).trim();

const getProfileUpdatedAt = (item = {}) =>
  item.avatarUpdatedAt ||
  item.profileUpdatedAt ||
  item.updatedAt ||
  item.imageUpdatedAt ||
  item.lastSeenAt ||
  '';

const normalizeUserProfile = (user = {}) => {
  const avatarUrl = getProfileImageUrl(user);
  const updatedAt = getProfileUpdatedAt(user);

  return {
    ...user,
    avatarUrl,
    photoUrl: avatarUrl,
    profilePic: avatarUrl,
    profilePicture: avatarUrl,
    profilePictureUrl: avatarUrl,
    avatarUpdatedAt: updatedAt,
    profileUpdatedAt: updatedAt,
  };
};

const normalizeChatProfile = (chat = {}) => {
  const receiverAvatarUrl = getReceiverProfileImageUrl(chat);
  const updatedAt = getProfileUpdatedAt(chat);

  return {
    ...chat,
    receiverName: chat.receiverName || chat.receiverUsername || chat.receiverEmail || 'User',
    receiverEmail: chat.receiverEmail || '',
    receiverAvatarUrl,
    receiverAvatar: receiverAvatarUrl,
    receiverPhoto: receiverAvatarUrl,
    receiverPhotoUrl: receiverAvatarUrl,
    receiverPhotoURL: receiverAvatarUrl,
    receiverImage: receiverAvatarUrl,
    receiverImageUrl: receiverAvatarUrl,
    receiverProfilePic: receiverAvatarUrl,
    receiverProfilePicture: receiverAvatarUrl,
    receiverProfilePictureUrl: receiverAvatarUrl,
    avatarUpdatedAt: updatedAt,
    profileUpdatedAt: updatedAt,
  };
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
    const { data } = await api.post(`/rooms/${encodePathSegment(roomId)}/invites`, {
      userId,
      invitedUserId: userId,
    });
    return parseApiBody(data);
  },

  uploadRoomImage: async (roomId, payload) => {
    const encodedRoomId = encodePathSegment(roomId);

    if (!encodedRoomId) {
      throw new Error('Room ID is required to upload room image.');
    }

    const { data } = await api.post(`/rooms/${encodedRoomId}/image`, payload);
    return parseApiBody(data);
  },

  getRoomInvites: async () => {
    const { data } = await api.get('/rooms/invites');
    return data;
  },

  acceptRoomInvite: async (roomId) => {
    const { data } = await api.post(`/rooms/${encodePathSegment(roomId)}/invites/accept`);
    return parseApiBody(data);
  },

  declineRoomInvite: async (roomId) => {
    const { data } = await api.post(`/rooms/${encodePathSegment(roomId)}/invites/reject`);
    return parseApiBody(data);
  },

  createRoom: async (payload) => {
    const { data } = await api.post('/rooms', payload);
    return parseApiBody(data);
  },

  async joinRoom(roomId, joinCode = '') {
    const { data } = await api.post(`/rooms/${encodePathSegment(roomId)}/join`, {
      joinCode,
    });
    return parseApiBody(data);
  },

  async getRoomMessages(roomId, params = {}) {
    const { data } = await api.get(
      `/rooms/${encodePathSegment(roomId)}/messages`,
      { params }
    );
    return data;
  },

  async getRoomMembers(roomId) {
    const { data } = await api.get(
      `/rooms/${encodePathSegment(roomId)}/members`
    );
    return data.members || data || [];
  },

  async leaveRoom(roomId) {
    const { data } = await api.post(
      `/rooms/${encodePathSegment(roomId)}/leave`
    );
    return parseApiBody(data);
  },

  async requestJoinRoom(roomId) {
    const { data } = await api.post(`/rooms/${encodePathSegment(roomId)}/request`);
    return parseApiBody(data);
  },

  async getRoomJoinRequests(roomId) {
    const { data } = await api.get(`/rooms/${encodePathSegment(roomId)}/requests`);
    return data.requests || [];
  },

  async getHiddenRooms() {
    const { data } = await api.get('/rooms/hidden');
    return data.rooms || [];
  },

  async unhideRoom(roomId) {
    const { data } = await api.post(
      `/rooms/${encodePathSegment(roomId)}/unhide`
    );
    return parseApiBody(data);
  },

  async approveRoomJoinRequest(roomId, userId) {
    const { data } = await api.post(
      `/rooms/${encodePathSegment(roomId)}/requests/approve`,
      { userId }
    );
    return parseApiBody(data);
  },

  async hideRoom(roomId) {
    const { data } = await api.post(
      `/rooms/${encodePathSegment(roomId)}/hide`
    );
    return parseApiBody(data);
  },

  async deleteRoom(roomId) {
    const { data } = await api.delete(
      `/rooms/${encodePathSegment(roomId)}`
    );
    return parseApiBody(data);
  },
};

export const creatorApi = {
  async getProfile(userId) {
    const { data } = await api.get(endpoints.creator.profile, {
      params: { userId },
    });

    return normalizeUserProfile(parseApiBody(data)?.profile || parseApiBody(data));
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
      `${OPENLIBRARY_BASE_URL}/search.json?${queryParams.toString()}`,
      {
        signal: options.signal,
        timeout: API_TIMEOUT,
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
      `${OPENLIBRARY_BASE_URL}/works/${encodeURIComponent(bookId)}.json`,
      { timeout: API_TIMEOUT }
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
      `${OPENLIBRARY_BASE_URL}/works/${encodeURIComponent(cleanWorkId)}/editions.json?limit=50`,
      { timeout: API_TIMEOUT }
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
  const creatorId = String(userId || '').trim();

  if (!creatorId) {
    throw new Error('Creator userId is required.');
  }

  const privatePostsPath = endpoints?.creator?.privatePosts || '/creator/private-posts';

  const { data } = await api.get(privatePostsPath, {
    params: {
      userId: creatorId,
      creatorId,
      followingId: creatorId,
    },
  });

  if (typeof data?.body === 'string') {
    try {
      const parsed = JSON.parse(data.body);
      return parsed.posts || parsed.items || parsed.reels || [];
    } catch {
      return [];
    }
  }

  return data.posts || data.items || data.reels || [];
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

async explainPost(payload) {
  const { data } = await api.post('/posts/explain', payload);
  return data;
},

async askPostDoubt(payload) {
  const { data } = await api.post('/posts/ask-doubt', payload);
  return data;
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

async deletePost(post) {
  const postId = typeof post === 'string'
    ? post
    : post?.id || post?.reelId || post?.postId;

const session = await fetchAuthSession();

const userSub =
  session?.tokens?.idToken?.payload?.sub ||
  session?.tokens?.accessToken?.payload?.sub ||
  '';

const { data } = await api.post(endpoints.posts.delete, {
  id: postId,
  reelId: postId,
  postId,
  userId: userSub,
  authorId: userSub,
  ownerId: userSub,
});

  return parseApiBody(data);
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

  return parseApiBody(data);
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
    const parsed = parseApiBody(res.data);
    return normalizeUserProfile(parsed.profile || parsed);
  },

  async followUser(followingId) {
  const { data } = await api.post('/users/follow', { followingId });
  return data;
},

  updateProfile: async (payload) => {
    const res = await api.put('/users/profile', payload);
    return res.data.profile || res.data;
  },

  savePushToken: async (token, platform = 'web') => {
    const res = await api.post('/users/push-token', {
      token,
      platform,
    });

    return res.data;
  },
};



export const chatApi = {
  async searchUsers(query) {
    const { data } = await api.get(endpoints.chat.searchUsers, {
      params: { query },
    });

    return normalizeList(data).map(normalizeUserProfile);
  },

  async deleteChat(chatId) {
    const { data } = await api.delete(`/chats/${encodeURIComponent(chatId)}`);
    return data;
  },

  async getMediaViewUrl({ mediaKey }) {
    const { data } = await api.post('/media/view-url', {
      mediaKey,
    });

    const parsed = parseApiBody(data);

    return {
      ...parsed,
      mediaUrl: parsed?.mediaUrl || parsed?.fileUrl || parsed?.url || '',
      fileUrl: parsed?.fileUrl || parsed?.mediaUrl || parsed?.url || '',
    };
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
  const res = await api.get('/users/block-status', {
    params: { userId },
  });
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
    const normalizedUser = normalizeUserProfile(user);
    const { data } = await api.post(endpoints.chat.start, {
      receiverId: normalizedUser.userId || normalizedUser.id || normalizedUser.sub,
      receiverEmail: normalizedUser.email,
      receiverUsername: normalizedUser.username,
      receiverName: normalizedUser.name,
      receiverAvatarUrl: normalizedUser.avatarUrl,
      receiverPhotoUrl: normalizedUser.photoUrl,
      receiverProfilePic: normalizedUser.profilePic,
      receiverProfilePictureUrl: normalizedUser.profilePictureUrl,
      avatarUpdatedAt: normalizedUser.avatarUpdatedAt,
      profileUpdatedAt: normalizedUser.profileUpdatedAt,
    });

    const parsed = parseApiBody(data);
    return normalizeChatProfile({
      ...parsed,
      receiverAvatarUrl:
        parsed.receiverAvatarUrl ||
        parsed.receiverPhotoUrl ||
        parsed.receiverProfilePic ||
        parsed.receiverProfilePictureUrl ||
        normalizedUser.avatarUrl ||
        '',
      receiverPhotoUrl:
        parsed.receiverPhotoUrl ||
        parsed.receiverAvatarUrl ||
        parsed.receiverProfilePic ||
        parsed.receiverProfilePictureUrl ||
        normalizedUser.avatarUrl ||
        '',
      receiverProfilePic:
        parsed.receiverProfilePic ||
        parsed.receiverAvatarUrl ||
        parsed.receiverPhotoUrl ||
        parsed.receiverProfilePictureUrl ||
        normalizedUser.avatarUrl ||
        '',
      receiverProfilePictureUrl:
        parsed.receiverProfilePictureUrl ||
        parsed.receiverAvatarUrl ||
        parsed.receiverPhotoUrl ||
        parsed.receiverProfilePic ||
        normalizedUser.avatarUrl ||
        '',
    });
  },

  async getChats() {
    const { data } = await api.get(endpoints.chat.list);
    const chats = normalizeList(data).map(normalizeChatProfile);

    if (import.meta.env.DEV) {
      console.table(
        chats.map((chat) => ({
          chatId: chat.chatId,
          receiverId: chat.receiverId,
          receiverName: chat.receiverName,
          receiverAvatarUrl: chat.receiverAvatarUrl,
          receiverPhotoUrl: chat.receiverPhotoUrl,
          receiverProfilePic: chat.receiverProfilePic,
          genericPhotoUrl: chat.photoUrl || '',
          genericAvatarUrl: chat.avatarUrl || '',
        }))
      );
    }

    return chats;
  },

  async getMessages(chatId) {
    const { data } = await api.get(endpoints.chat.messages, {
      params: { chatId },
    });

    return normalizeList(data).map((message) => ({
      ...message,
      mediaKey: message.mediaKey || message.key || '',
      mediaUrl: message.mediaUrl || message.fileUrl || '',
      mediaName: message.mediaName || '',
      mediaType: message.mediaType || '',
      reactions: message.reactions || {},
    }));
  },

  async sendMessage({
    chatId,
    receiverId,
    text = '',
    mediaKey = '',
    mediaUrl = '',
    mediaName = '',
    mediaType = '',
    clientId = '',
  }) {
    const { data } = await api.post(endpoints.chat.send, {
      chatId,
      receiverId,
      text,
      mediaKey,
      mediaUrl,
      mediaName,
      mediaType,
      clientId,
    });

    return parseApiBody(data);
  },

  async getMediaUploadUrl({ fileName, fileType }) {
    const { data } = await api.post('/media/upload-url', {
      fileName,
      fileType,
    });

    const parsed = parseApiBody(data);

    return {
      ...parsed,
      uploadUrl: parsed?.uploadUrl || '',
      mediaKey: parsed?.mediaKey || parsed?.key || '',
      mediaUrl: parsed?.mediaUrl || parsed?.fileUrl || parsed?.url || '',
      fileUrl: parsed?.fileUrl || parsed?.mediaUrl || parsed?.url || '',
    };
  },

  async getUploadUrl(payload) {
    return this.getMediaUploadUrl(payload);
  },

  async reactToMessage({ chatId, messageId, emoji }) {
    const { data } = await api.post('/messages/react', {
      chatId,
      messageId,
      emoji,
    });

    return parseApiBody(data);
  },

  async editMessage({ chatId, messageId, text }) {
    const { data } = await api.post('/messages/edit', {
      chatId,
      messageId,
      text,
    });

    return parseApiBody(data);
  },

  async deleteMessage({ chatId, messageId }) {
    const { data } = await api.post('/messages/delete', {
      chatId,
      messageId,
    });

    return parseApiBody(data);
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

      if (import.meta.env.DEV) {
        console.log('✅ Push token saved');
      }
      return token;
    } catch (err) {
      console.error('❌ Push notification setup failed:', err);
      return null;
    }
  }
};

export default api;