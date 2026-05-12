export type LiveChatActor = 'user' | 'assistant' | 'admin';

export type LiveChatStoredMessage = {
  id: string;
  role: LiveChatActor;
  text: string;
  createdAt: string;
};

export type LiveChatThread = {
  id: string;
  userId: number | null;
  userLabel: string;
  updatedAt: string;
  unreadCount: number;
  messages: LiveChatStoredMessage[];
};

const STORAGE_KEY = 'birbuket_live_chat_threads_v1';
const THREAD_KEY_PREFIX = 'livechat-user-';

const nowIso = () => new Date().toISOString();
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const parseThreads = (raw: string | null): LiveChatThread[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeThreads = (threads: LiveChatThread[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch {
    //
  }
};

const normalizeUserLabel = (userId: number | null, fallback?: string): string => {
  const v = String(fallback || '').trim();
  if (v) return v;
  if (typeof userId === 'number' && Number.isFinite(userId) && userId > 0) return `User #${userId}`;
  return 'Qonaq istifadəçi';
};

const threadIdForUser = (userId: number | null): string =>
  `${THREAD_KEY_PREFIX}${typeof userId === 'number' && userId > 0 ? userId : 'guest'}`;

const ensureThread = (threads: LiveChatThread[], userId: number | null, userLabel?: string): LiveChatThread => {
  const threadId = threadIdForUser(userId);
  const existing = threads.find((t) => t.id === threadId);
  if (existing) {
    if (userLabel && userLabel.trim() && existing.userLabel !== userLabel.trim()) {
      existing.userLabel = userLabel.trim();
    }
    return existing;
  }
  const next: LiveChatThread = {
    id: threadId,
    userId: typeof userId === 'number' && userId > 0 ? userId : null,
    userLabel: normalizeUserLabel(userId, userLabel),
    updatedAt: nowIso(),
    unreadCount: 0,
    messages: [],
  };
  threads.unshift(next);
  return next;
};

export const liveChatAdminStore = {
  listThreads: (): LiveChatThread[] => {
    const threads = parseThreads(localStorage.getItem(STORAGE_KEY));
    return [...threads].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },
  getThread: (userId: number | null): LiveChatThread => {
    const threads = parseThreads(localStorage.getItem(STORAGE_KEY));
    const thread = ensureThread(threads, userId);
    writeThreads(threads);
    return thread;
  },
  appendUserMessage: (params: { userId: number | null; userLabel?: string; text: string }): LiveChatStoredMessage | null => {
    const text = String(params.text || '').trim();
    if (!text) return null;
    const threads = parseThreads(localStorage.getItem(STORAGE_KEY));
    const thread = ensureThread(threads, params.userId, params.userLabel);
    const message: LiveChatStoredMessage = {
      id: makeId(),
      role: 'user',
      text,
      createdAt: nowIso(),
    };
    thread.messages.push(message);
    thread.unreadCount = Number(thread.unreadCount || 0) + 1;
    thread.updatedAt = message.createdAt;
    writeThreads(threads);
    return message;
  },
  appendAdminMessage: (params: { threadId: string; text: string }): LiveChatStoredMessage | null => {
    const text = String(params.text || '').trim();
    if (!text) return null;
    const threads = parseThreads(localStorage.getItem(STORAGE_KEY));
    const thread = threads.find((t) => t.id === params.threadId);
    if (!thread) return null;
    const message: LiveChatStoredMessage = {
      id: makeId(),
      role: 'admin',
      text,
      createdAt: nowIso(),
    };
    thread.messages.push(message);
    thread.updatedAt = message.createdAt;
    writeThreads(threads);
    return message;
  },
  resetUnread: (threadId: string) => {
    const threads = parseThreads(localStorage.getItem(STORAGE_KEY));
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;
    thread.unreadCount = 0;
    writeThreads(threads);
  },
};
