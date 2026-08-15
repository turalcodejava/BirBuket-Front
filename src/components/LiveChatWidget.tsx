import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send, X, Loader2 } from 'lucide-react';
import { authService, cartService, checkoutService } from '../services/api';
import { deliveryTariffsChatText } from '../constants/deliveryTariffs';
import { useAuth } from '../context/AuthContext';
import { liveChatAdminStore } from '../utils/liveChatAdminStore';

type ChatRole = 'user' | 'assistant';
type ChatMessage = { id: string; role: ChatRole; text: string };

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const quickReply = (text: string): string | null => {
  const q = text.toLowerCase().trim();
  if (!q) return null;

  if (/salam|sabahınız xeyir|axşamınız xeyir/.test(q)) {
    return 'Salam! Sizə necə kömək edə bilərəm?';
  }
  if (/necəsən|necesen|necəsiz|necesiz|necəsiniz|necesiniz|hal.?nec/.test(q)) {
    return 'Sağ olun, yaxşıyam. Siz necəsiniz? Sizə necə kömək edə bilərik?';
  }
  if (/adın nədir|kimsən|sen kimsen|siz kimsiniz/.test(q)) {
    return 'Mən BirBuket canlı söhbət köməkçisiyəm. Sualınızı yaza bilərsiniz.';
  }
  if (/sağ ol|sag ol|tesekkur|təşəkkür/.test(q)) {
    return 'Siz sağ olun! Başqa sualınız olsa məmnuniyyətlə kömək edərəm.';
  }
  if (/saat necedir|vaxt necedir|time/.test(q)) {
    return 'Dəqiq vaxtı cihazınızın saatından görə bilərsiniz. Mən sizə BirBuketlə bağlı suallarda kömək edə bilərəm.';
  }
  if (/kodumu nece yenile|kodumu necə yenilə|kodu nece yenile|kodu necə yenilə|yenileme|yeniləmə/.test(q)) {
    return 'Kodu yeniləmək üçün layihə qovluğunda `git pull` edin, sonra `npm install` və `npm run dev` (və ya `npm run build`) ilə yoxlayın. İstəsəniz addım-addım da yönləndirə bilərəm.';
  }
  if (/necə.*sifariş|sifariş.*necə|order.*necə/.test(q)) {
    return 'Sifariş üçün məhsulu seçin, səbətə əlavə edin və checkout səhifəsində ünvan/ödəniş məlumatlarını daxil edib təsdiqləyin.';
  }
  if (/çatdırılma|delivery/.test(q)) {
    return `${deliveryTariffsChatText()} Checkout zamanı ünvan və saat seçilir; status hesabınızdakı sifarişlərdən izlənilir.`;
  }
  if (/ödəniş|payment|kart|cash/.test(q)) {
    return 'Ödəniş üsulları CARD və CASH-dir. CARD seçildikdə ödəniş linkinə yönləndirmə olur, CASH seçildikdə sifariş birbaşa rəsmiləşir.';
  }
  if (/iş saat|neçə.*açı|neçə.*bağ|ünvan/.test(q)) {
    return 'Mağaza məlumatları və ünvan bölmələri saytda göstərilir. Dəqiq məkan üçün əlaqə/ünvan hissəsinə baxa bilərsiniz.';
  }
  return null;
};

const backendReply = (text: string): string | null => {
  const q = text.toLowerCase();
  if (/sifariş|order|status|çatdırılma|delivery/.test(q)) {
    return `${deliveryTariffsChatText()} Sifariş statusu üçün nömrəni yazın (PENDING → DELIVERED və s.).`;
  }
  if (/ödəniş|payment|kart|cash|card/.test(q)) {
    return 'Ödənişlə bağlı suallarda checkout nəticəsi vacibdir: CARD seçilibsə payment URL açılmalıdır, CASH seçilibsə sifariş birbaşa yaradılır.';
  }
  if (/draft|render|buket|custom/.test(q)) {
    return 'Custom bouquet axınında ardıcıllıq belədir: /api/auth/me -> /api/order/custom-bouquet/draft -> /api/order/custom-bouquet/checkout.';
  }
  if (/401|403|xəta|error|forbidden|unauthorized/.test(q)) {
    return '401 adətən token/auth problemidir, 403 isə permission və ya userId mismatch ola bilər. Dəqiq cavab üçün endpoint və response message paylaşın.';
  }
  return null;
};

export default function LiveChatWidget() {
  const { token, userId, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      role: 'assistant',
      text: 'Salam! Canlı söhbətə xoş gəldiniz. Sualınızı yazın, uyğun olaraq dərhal cavab verək.',
    },
  ]);

  const canSend = useMemo(() => draft.trim().length > 0 && !loading, [draft, loading]);
  const currentThreadId = useMemo(
    () => `livechat-user-${typeof userId === 'number' && userId > 0 ? userId : 'guest'}`,
    [userId]
  );

  const resolveEffectiveUserId = async (): Promise<number | null> => {
    if (!token) return null;
    if (userId && userId > 0) return userId;
    try {
      const meRes = await authService.getMe();
      const me = meRes?.data;
      const candidates = [(me as any)?.userId, (me as any)?.id, (me as any)?.user_id, (me as any)?.uid, (me as any)?.sub];
      for (const rawId of candidates) {
        if (typeof rawId === 'number' && rawId > 0) return rawId;
        if (typeof rawId === 'string' && /^\d+$/.test(rawId.trim())) return Number(rawId.trim());
      }
    } catch {
      return null;
    }
    return null;
  };

  const extractOrderRows = (payload: any): any[] => {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.content)) return payload.content;
    return [];
  };

  const extractCartRows = (payload: any): any[] => {
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  };

  const askPresetQuestion = async (questionText: string, key: 'orders' | 'where' | 'count' | 'cart' | 'profile') => {
    if (loading) return;
    setMessages((prev) => [...prev, { id: makeId(), role: 'user', text: questionText }]);
    setLoading(true);
    try {
      const effectiveUserId = await resolveEffectiveUserId();
      if (!effectiveUserId) {
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'assistant', text: 'Sifariş məlumatını göstərmək üçün zəhmət olmasa hesabınıza daxil olun.' },
        ]);
        return;
      }
      if (key === 'profile') {
        const me = await authService.getMe();
        const user = me?.data;
        const name = [user?.name, user?.surname].filter(Boolean).join(' ').trim() || user?.username || 'İstifadəçi';
        const email = user?.email ? `Email: ${user.email}` : 'Email məlumatı yoxdur';
        setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text: `${name}\n${email}` }]);
        return;
      }

      if (key === 'cart') {
        const cartRes = await cartService.getCart(effectiveUserId);
        const cartItems = extractCartRows(cartRes);
        if (cartItems.length === 0) {
          setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text: 'Səbətiniz hazırda boşdur.' }]);
          return;
        }
        const top = cartItems.slice(0, 5).map((it: any) => {
          const title = String(it?.productName || it?.name || `Məhsul #${it?.productId || '-'}`);
          const qty = Number(it?.quantity || 0);
          return `- ${title} x ${qty}`;
        });
        setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text: `Səbətinizdə:\n${top.join('\n')}` }]);
        return;
      }

      const ordersRes = await checkoutService.getOrders(effectiveUserId);
      const orders = extractOrderRows(ordersRes);
      if (orders.length === 0) {
        setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text: 'Hazırda hesabınızda sifariş görünmür.' }]);
        return;
      }

      if (key === 'where') {
        const latest = orders[0];
        const status = String(latest?.status || latest?.orderStatus || 'PENDING').toUpperCase();
        const orderNo = latest?.orderNumber || latest?.id || '-';
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'assistant', text: `Son sifarişiniz (#${orderNo}) hazırda "${status}" mərhələsindədir.` },
        ]);
        return;
      }

      if (key === 'count') {
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'assistant', text: `Sizin hesabda ümumi ${orders.length} sifariş görünür.` },
        ]);
        return;
      }

      const top = orders.slice(0, 3).map((o: any) => {
        const no = o?.orderNumber || o?.id || '-';
        const st = String(o?.status || o?.orderStatus || 'PENDING').toUpperCase();
        return `#${no} — ${st}`;
      });
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: 'assistant', text: `Sizin son sifarişlər:\n${top.map((x) => `- ${x}`).join('\n')}` },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: 'assistant', text: err?.response?.data?.message || 'Sifariş məlumatını oxumaq mümkün olmadı.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: makeId(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    liveChatAdminStore.appendUserMessage({
      userId: typeof userId === 'number' && userId > 0 ? userId : null,
      userLabel: user?.username || user?.email || '',
      text,
    });
    setDraft('');
    setLoading(true);

    setTimeout(() => {
      const knownReply = quickReply(text) || backendReply(text);
      const reply = knownReply
        ? knownReply
        : 'Sualınız qeydə alındı. Bu mövzu BirBuket komandası tərəfindən tez bir zamanda cavablandırılacaq.';
      setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text: reply }]);
      setLoading(false);
    }, 450);
  };

  const syncAdminReplies = () => {
    const threads = liveChatAdminStore.listThreads();
    const thread = threads.find((t) => t.id === currentThreadId);
    if (!thread) return;
    const adminMessages = thread.messages.filter((m) => m.role === 'admin');
    setMessages((prev) => {
      const existingKeys = new Set(prev.map((m) => `${m.role}:${m.text}`));
      const incoming = adminMessages.filter((m) => !existingKeys.has(`assistant:${m.text}`));
      if (incoming.length === 0) return prev;
      return [
        ...prev,
        ...incoming.map((m) => ({
          id: m.id,
          role: 'assistant' as const,
          text: m.text,
        })),
      ];
    });
  };

  useEffect(() => {
    if (!open) return;
    syncAdminReplies();
    const id = window.setInterval(syncAdminReplies, 2500);
    return () => window.clearInterval(id);
  }, [open, currentThreadId]);

  return (
    <>
      {open ? (
        <div className="fixed bottom-5 right-5 z-[90] w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-floral-muted/20 bg-white shadow-2xl dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-floral-muted/15 px-4 py-3">
            <p className="text-sm font-black text-floral-deep dark:text-white">Canlı söhbət</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-floral-muted hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Söhbəti bağla"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[360px] space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'ml-10 bg-primary/15 text-floral-deep'
                    : 'mr-10 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading ? (
              <div className="mr-10 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cavab hazırlanır...
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-floral-muted/10 px-3 py-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => askPresetQuestion('Sifarişlərim', 'orders')}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200"
            >
              Sifarişlərim
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => askPresetQuestion('Sifarişim hardadır?', 'where')}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200"
            >
              Sifarişim hardadır?
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => askPresetQuestion('Neçə sifarişim var?', 'count')}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200"
            >
              Neçə sifarişim var?
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => askPresetQuestion('Səbətimdə nə var?', 'cart')}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200"
            >
              Səbətimdə nə var?
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => askPresetQuestion('Profil məlumatlarım', 'profile')}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200"
            >
              Profil məlumatlarım
            </button>
          </div>

          <form onSubmit={sendMessage} className="border-t border-floral-muted/15 p-3">
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Sualınızı yazın..."
                className="h-10 flex-1 rounded-xl border border-floral-muted/20 bg-[#fdfcf5] px-3 text-sm outline-none focus:border-primary dark:bg-slate-800"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-floral-deep disabled:opacity-60"
                aria-label="Göndər"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!open && (
        <a
          href="https://wa.me/994518468551"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-[88px] right-5 z-[80] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl hover:scale-105 transition-transform"
          aria-label="WhatsApp ilə əlaqə"
        >
          <svg viewBox="0 0 448 512" className="h-7 w-7 fill-current">
            <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
          </svg>
        </a>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen(true);
          syncAdminReplies();
        }}
        className="fixed bottom-5 right-5 z-[80] inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-floral-deep shadow-xl hover:scale-105"
        aria-label="Canlı söhbəti aç"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </>
  );
}

