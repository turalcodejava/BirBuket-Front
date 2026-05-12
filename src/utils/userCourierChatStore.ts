export type UserCourierChatRole = 'user' | 'courier';

export type UserCourierChatMessage = {
  id: string;
  orderId: number;
  sender: UserCourierChatRole;
  text: string;
  createdAt: string;
};

const STORAGE_KEY = 'birbuket_user_courier_chat_v1';

const safeParse = (raw: string | null): UserCourierChatMessage[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as UserCourierChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m) =>
        m &&
        typeof m === 'object' &&
        Number.isFinite(Number(m.orderId)) &&
        (m.sender === 'user' || m.sender === 'courier') &&
        typeof m.text === 'string'
    );
  } catch {
    return [];
  }
};

const readAll = (): UserCourierChatMessage[] => safeParse(localStorage.getItem(STORAGE_KEY));

const writeAll = (messages: UserCourierChatMessage[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-1000)));
};

export const listUserCourierMessages = (orderId: number): UserCourierChatMessage[] =>
  readAll()
    .filter((m) => Number(m.orderId) === Number(orderId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

export const sendUserCourierMessage = (
  orderId: number,
  sender: UserCourierChatRole,
  text: string
): UserCourierChatMessage | null => {
  const clean = text.trim();
  if (!orderId || !clean) return null;
  const all = readAll();
  const msg: UserCourierChatMessage = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    orderId: Number(orderId),
    sender,
    text: clean.slice(0, 1000),
    createdAt: new Date().toISOString(),
  };
  all.push(msg);
  writeAll(all);
  return msg;
};

