import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { chatService } from '../../services/api';
import { listUserCourierMessages, sendUserCourierMessage, type UserCourierChatRole } from '../../utils/userCourierChatStore';

type Props = {
  open: boolean;
  orderId: number;
  selfRole: UserCourierChatRole;
  selfUserId?: number | null;
  customerUserId?: number | null;
  courierUserId?: number | null;
  title?: string;
  onClose: () => void;
};

const toClock = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
};

type UiChatMessage = {
  id: string | number;
  sender: UserCourierChatRole;
  text: string;
  createdAt: string;
};

export default function UserCourierChatModal({
  open,
  orderId,
  selfRole,
  selfUserId,
  customerUserId,
  courierUserId,
  title,
  onClose,
}: Props) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const backendReady = Boolean(
    open &&
      orderId > 0 &&
      Number(selfUserId || 0) > 0 &&
      Number(customerUserId || 0) > 0 &&
      Number(courierUserId || 0) > 0
  );

  const refreshLocal = () => {
    const list = listUserCourierMessages(orderId).map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      createdAt: m.createdAt,
    }));
    setMessages(list);
  };

  const refreshRemoteMessages = async (convId: number) => {
    const rows = await chatService.getConversationMessages(convId);
    const list: UiChatMessage[] = rows.map((m) => ({
      id: m.id,
      sender: Number(m.senderId) === Number(courierUserId) ? 'courier' : 'user',
      text: m.content,
      createdAt: m.createdAt || new Date().toISOString(),
    }));
    setMessages(list);
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!backendReady) {
      setConversationId(null);
      refreshLocal();
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const conv = await chatService.createOrGetDirectConversation({
          customerUserId: Number(customerUserId),
          courierUserId: Number(courierUserId),
          orderId: Number(orderId),
        });
        if (cancelled) return;
        setConversationId(conv.id);
        await refreshRemoteMessages(conv.id);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.message || 'Chat qoşulması mümkün olmadı.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, backendReady, orderId, customerUserId, courierUserId]);

  useEffect(() => {
    if (!open || !backendReady || !conversationId) return;
    let stopped = false;
    const tick = async () => {
      try {
        await refreshRemoteMessages(conversationId);
      } catch {
        // keep polling
      }
      if (stopped) return;
      window.setTimeout(tick, 1600);
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [open, backendReady, conversationId, courierUserId]);

  useEffect(() => {
    if (!open || backendReady) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== 'birbuket_user_courier_chat_v1') return;
      refreshLocal();
    };
    window.addEventListener('storage', onStorage);
    const intervalId = window.setInterval(refreshLocal, 1800);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(intervalId);
    };
  }, [open, orderId, backendReady]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const canSend =
    draft.trim().length > 0 &&
    (!backendReady || (conversationId && Number(selfUserId || 0) > 0));
  const headerText = title || `Sifariş #${orderId} — User/Kuryer chat`;

  const helpText = useMemo(
    () =>
      selfRole === 'user'
        ? 'Burada yalnız siz və bu sifarişin kuryeri yazışa bilər.'
        : 'Burada yalnız bu sifarişin istifadəçisi və siz yazışa bilərsiniz.',
    [selfRole]
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const text = draft.trim();
    if (!text) return;
    if (!backendReady) {
      const sent = sendUserCourierMessage(orderId, selfRole, text);
      if (!sent) return;
      setDraft('');
      refreshLocal();
      return;
    }
    if (!conversationId || !selfUserId) return;
    setLoading(true);
    setError(null);
    chatService
      .sendConversationMessage({
        conversationId,
        senderId: Number(selfUserId),
        content: text,
      })
      .then(async () => {
        setDraft('');
        await refreshRemoteMessages(conversationId);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message || 'Mesaj göndərilə bilmədi.');
      })
      .finally(() => setLoading(false));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-end bg-black/35 p-3 sm:p-6">
      <div className="flex h-[min(78vh,620px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-primary/25 bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-primary/15 px-4 py-3">
          <div>
            <p className="text-sm font-black text-floral-deep dark:text-white">{headerText}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{helpText}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Söhbəti bağla"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-slate-50/70 px-3 py-3 dark:bg-slate-950/40">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
              Chat yenilənir...
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary/25 bg-white p-3 text-xs text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
              {backendReady
                ? 'İlk mesajı göndərin. Bu direct chat yalnız həmin user və kuryer üçündür.'
                : 'İlk mesajı göndərin. Backend direct chat qoşulanda bu söhbət avtomatik serverdən işləyəcək.'}
            </div>
          ) : null}
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div key={m.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    isUser
                      ? 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-100'
                      : 'bg-primary/20 text-floral-deep dark:text-floral-deep-dark'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className="mt-1 text-right text-[10px] text-slate-500 dark:text-slate-400">
                    {m.sender === 'user' ? 'User' : 'Kuryer'} • {toClock(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={submit} className="border-t border-primary/15 bg-white p-3 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Mesajınızı yazın..."
              className="h-11 flex-1 rounded-xl border border-primary/20 bg-[#fdfcf5] px-3 text-sm outline-none focus:border-primary dark:bg-slate-800"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-floral-deep disabled:opacity-60"
              aria-label="Göndər"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="sr-only"
        aria-label="Bağla"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
    </div>
  );
}

