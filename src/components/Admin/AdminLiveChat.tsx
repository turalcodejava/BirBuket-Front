import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { liveChatAdminStore, LiveChatThread } from '../../utils/liveChatAdminStore';

export default function AdminLiveChat() {
  const [threads, setThreads] = useState<LiveChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [draft, setDraft] = useState('');

  const loadThreads = () => {
    const rows = liveChatAdminStore.listThreads();
    setThreads(rows);
    if (!activeThreadId && rows.length > 0) setActiveThreadId(rows[0].id);
  };

  useEffect(() => {
    loadThreads();
    const id = window.setInterval(loadThreads, 2000);
    return () => window.clearInterval(id);
  }, []);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  useEffect(() => {
    if (!activeThreadId) return;
    liveChatAdminStore.resetUnread(activeThreadId);
    loadThreads();
  }, [activeThreadId]);

  const sendReply = () => {
    const text = draft.trim();
    if (!activeThread || !text) return;
    liveChatAdminStore.appendAdminMessage({ threadId: activeThread.id, text });
    setDraft('');
    loadThreads();
  };

  return (
    <div className="min-h-screen bg-[#fdfcf0] p-6 lg:p-8 dark:bg-background-dark">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-black">Canlı söhbət</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-floral-muted/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
          <div className="space-y-2">
            {threads.length === 0 ? (
              <p className="rounded-xl bg-primary/5 px-3 py-2 text-sm text-floral-muted">Hələ mesaj yoxdur.</p>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveThreadId(t.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                    activeThreadId === t.id
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-floral-muted/10 hover:bg-primary/5'
                  }`}
                >
                  <p className="text-sm font-bold">{t.userLabel || `User #${t.userId || '-'}`}</p>
                  <p className="mt-1 text-[11px] text-floral-muted">
                    {t.updatedAt ? new Date(t.updatedAt).toLocaleString('az-AZ') : '-'}
                  </p>
                  {t.unreadCount > 0 ? (
                    <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
                      Yeni: {t.unreadCount}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </aside>
        <section className="rounded-2xl border border-floral-muted/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          {!activeThread ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-floral-muted">
              <MessageCircle className="mr-2 h-4 w-4" />
              Söhbət seçin.
            </div>
          ) : (
            <>
              <div className="mb-3 border-b border-floral-muted/10 pb-2">
                <p className="font-black">{activeThread.userLabel || `User #${activeThread.userId || '-'}`}</p>
              </div>
              <div className="h-[52vh] space-y-3 overflow-y-auto rounded-xl bg-[#fcfbf7] p-3 dark:bg-white/[0.03]">
                {activeThread.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100'
                        : 'ml-auto bg-primary/20 text-floral-deep'
                    }`}
                  >
                    <p>{m.text}</p>
                    <p className="mt-1 text-[10px] opacity-60">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString('az-AZ') : ''}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="Cavabınızı yazın..."
                  className="h-11 flex-1 rounded-xl border border-floral-muted/20 px-3 text-sm outline-none focus:border-primary dark:bg-white/5"
                />
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={!draft.trim()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-floral-deep disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
