import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Search, Send, ArrowLeft, ArrowDown } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { withScreen } from "@/stores/screenStore";
import { formatClockTime, formatRelativeTime } from "@/lib/time";

interface ChatMessage {
  id: string;
  text: string;
  sender: "me" | "them";
  time: string;
  createdAt?: string;
}

interface Conversation {
  id: string;
  otherUser: { id: string; name: string; avatar?: string } | null;
  lastMessage: string;
  lastTime: string;
  messages: ChatMessage[];
}

const QUICK_REPLIES = ["I'm interested", "What time works for you?", "Can you share the address?", "Sounds good"];

const dayKey = (iso?: string) => (iso ? new Date(iso).toDateString() : "");
const gapMinutes = (a: { createdAt?: string }, b: { createdAt?: string }) =>
  a.createdAt && b.createdAt ? (Date.parse(b.createdAt) - Date.parse(a.createdAt)) / 60000 : 0;
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  // Track the conversationId from the URL that we still need to auto-select
  const pendingConvId = searchParams.get("conversationId");
  const handledInitialSelect = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [showJump, setShowJump] = useState(false);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 240);
  };
  // Grow the composer with the text (up to its max height), shrink after sending.
  const growTextarea = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  };

  const fetchConversations = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get("/conversations");
      const convs = res.data.conversations.map((c: any) => ({
        id: c.id ?? c._id?.toString?.(),
        otherUser: c.otherUser,
        lastMessage: c.lastMessage,
        lastTime: c.lastTime,
        messages: [],
      }));
      setConversations(convs);
    } catch (err) {
      console.error("Failed to fetch conversations", err);
      setError("We couldn’t load your conversations right now.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // First open: a short blank "setting up" screen so the chat list doesn't pop in half-loaded.
  useEffect(() => {
    void withScreen("Setting up your chats", async () => {
      await fetchConversations();
    }, 1200);
  }, [fetchConversations]);

  const fetchMessages = useCallback(
    async (convId: string) => {
      try {
        const res = await api.get(`/conversations/${convId}/messages`);
        const msgs = res.data.messages.map((m: any) => ({
          id: m.id ?? m._id?.toString?.(),
          text: m.text,
          sender: m.senderId === user?.id ? "me" : ("them" as "me" | "them"),
          time: formatClockTime(m.createdAt, m.time),
          createdAt: m.createdAt,
        }));
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, messages: msgs } : c)),
        );
        return msgs;
      } catch (err) {
        console.error("Failed to fetch messages", err);
        return [];
      }
    },
    [user?.id],
  );

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    setShowChat(true);
    // Fetch messages for this conversation
    if (conv.messages.length === 0) {
      const msgs = await fetchMessages(conv.id);
      setSelectedConv((prev) => (prev ? { ...prev, messages: msgs } : null));
    }
  };

  // Auto-select a conversation when arriving with ?conversationId=xxx
  useEffect(() => {
    if (handledInitialSelect.current) return;
    if (!pendingConvId) return;

    const autoSelect = async () => {
      // Check if the conversation is already in the list
      const existing = conversations.find((c) => c.id === pendingConvId);
      if (existing) {
        handledInitialSelect.current = true;
        await handleSelectConversation(existing);
        return;
      }

      // Otherwise fetch it directly
      try {
        const res = await api.get(`/conversations/${pendingConvId}`);
        const convData = res.data.conversation;
        if (convData) {
          const conv: Conversation = {
            id: convData.id ?? convData._id?.toString?.(),
            otherUser: convData.otherUser,
            lastMessage: convData.lastMessage,
            lastTime: convData.lastTime,
            messages: [],
          };
          // Add it to the conversations list so it appears in the sidebar
          setConversations((prev) =>
            prev.some((c) => c.id === conv.id)
              ? prev
              : [conv, ...prev],
          );
          handledInitialSelect.current = true;
          await handleSelectConversation(conv);
        }
      } catch (err) {
        console.error("Failed to auto-select conversation", err);
      }
    };

    autoSelect();
  }, [pendingConvId, conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the newest message in view.
  const messageCount = selectedConv?.messages.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount, selectedConv?.id]);

  // Live updates without websockets: poll the open chat every few seconds and
  // the conversation list less often, only while the page is visible.
  const selectedId = selectedConv?.id;
  useEffect(() => {
    if (!selectedId) return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await api.get(`/conversations/${selectedId}/messages`);
        const msgs: ChatMessage[] = res.data.messages.map((m: any) => ({
          id: m.id ?? m._id?.toString?.(),
          text: m.text,
          sender: m.senderId === user?.id ? "me" : "them",
          time: formatClockTime(m.createdAt, m.time),
          createdAt: m.createdAt,
        }));
        setSelectedConv((prev) => {
          if (!prev || prev.id !== selectedId) return prev;
          const last = prev.messages[prev.messages.length - 1]?.id;
          if (msgs.length === prev.messages.length && msgs[msgs.length - 1]?.id === last) return prev;
          return { ...prev, messages: msgs };
        });
      } catch {
        // Transient network error: try again on the next tick.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [selectedId, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      api
        .get("/conversations")
        .then((res) => {
          setConversations((prev) =>
            res.data.conversations.map((c: any) => {
              const id = c.id ?? c._id?.toString?.();
              const existing = prev.find((p) => p.id === id);
              return {
                id,
                otherUser: c.otherUser,
                lastMessage: c.lastMessage,
                lastTime: c.lastTime,
                messages: existing?.messages ?? [],
              };
            }),
          );
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const filteredConversations = conversations.filter((c) =>
    c.otherUser?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSendMessage = async (override?: string) => {
    const text = (override ?? messageInput).trim();
    if (!text || !selectedConv) return;
    try {
      const res = await api.post(`/conversations/${selectedConv.id}/messages`, {
        text,
      });
      const newMsg = res.data.message;
      const chatMsg: ChatMessage = {
        id: newMsg.id ?? newMsg._id?.toString?.(),
        text: newMsg.text,
        sender: "me",
        time: formatClockTime(newMsg.createdAt, newMsg.time),
        createdAt: newMsg.createdAt,
      };
      setSelectedConv((prev) =>
        prev ? { ...prev, messages: [...prev.messages, chatMsg] } : null,
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConv.id
            ? { ...c, lastMessage: newMsg.text, lastTime: newMsg.createdAt }
            : c,
        ),
      );
      setMessageInput("");
      requestAnimationFrame(growTextarea);
      void haptic("light");
    } catch (err) {
      console.error("Failed to send message", err);
      setError("Your message could not be sent.");
    }
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  return (
    <div className="flex h-[calc(100dvh-64px-7rem)] md:h-[calc(100dvh-64px)]">
      {/* Conversation list */}
      <div className={`w-full shrink-0 flex-col border-r border-border bg-card md:flex md:w-[22rem] ${showChat ? "hidden" : "flex"}`}>
        <div className="border-b border-border p-4">
          <p className="label-mono">Inbox</p>
          <h1 className="mb-3 mt-1 text-2xl font-extrabold">Messages</h1>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search conversations" placeholder="Search people" className="h-10 pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          {isLoading ? (
            <div className="space-y-1 p-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <EmptyState art="chat" title={searchQuery ? "No one by that name" : "No conversations yet"} compact>
              {searchQuery ? "Try another name." : "Apply to a task, or pick an applicant, and your chat opens here."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {filteredConversations.map((conv) => {
                const active = selectedConv?.id === conv.id;
                return (
                  <li key={conv.id}>
                    <button
                      onClick={() => handleSelectConversation(conv)}
                      className={`relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 ${active ? "bg-muted/70" : ""}`}
                    >
                      {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" aria-hidden="true" />}
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={conv.otherUser?.avatar} />
                        <AvatarFallback className="bg-primary/10 font-bold text-primary">{conv.otherUser ? initials(conv.otherUser.name).slice(0, 2) : "?"}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-bold">{conv.otherUser?.name || "Unknown"}</span>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatRelativeTime(conv.lastTime)}</span>
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">{conv.lastMessage || "Say hello"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Chat */}
      <div className={`min-w-0 flex-1 flex-col md:flex ${showChat ? "flex" : "hidden"}`}>
        {selectedConv ? (
          <>
            <div className="flex items-center gap-3 border-b border-border bg-card px-3 py-3 md:px-5">
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Back to conversations" onClick={() => setShowChat(false)}>
                <ArrowLeft size={20} />
              </Button>
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedConv.otherUser?.avatar} />
                <AvatarFallback className="bg-primary/10 font-bold text-primary">{selectedConv.otherUser ? initials(selectedConv.otherUser.name).slice(0, 2) : "?"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold leading-tight">{selectedConv.otherUser?.name || "Unknown"}</p>
                {selectedConv.otherUser && (
                  <Link to={`/profile/${selectedConv.otherUser.id}`} className="text-xs font-semibold text-primary hover:underline">
                    View profile
                  </Link>
                )}
              </div>
            </div>

            <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto bg-background bg-dots px-3 py-4 md:px-6">
              {selectedConv.messages.length === 0 ? (
                <EmptyState art="chat" title="Start the conversation" compact>
                  Introduce yourself, confirm the details, and agree a time.
                </EmptyState>
              ) : (
                <div className="mx-auto max-w-2xl">
                  {selectedConv.messages.map((msg, i, all) => {
                    const prev = all[i - 1];
                    const next = all[i + 1];
                    const newDay = !prev || dayKey(prev.createdAt) !== dayKey(msg.createdAt);
                    const mine = msg.sender === "me";
                    const startsCluster = !prev || prev.sender !== msg.sender || newDay || gapMinutes(prev, msg) > 5;
                    const endsCluster = !next || next.sender !== msg.sender || dayKey(next.createdAt) !== dayKey(msg.createdAt) || gapMinutes(msg, next) > 5;
                    return (
                      <div key={msg.id}>
                        {newDay && msg.createdAt && (
                          <div className="my-4 flex items-center gap-3">
                            <span className="h-px flex-1 bg-border" />
                            <span className="label-mono">{dayLabel(msg.createdAt)}</span>
                            <span className="h-px flex-1 bg-border" />
                          </div>
                        )}
                        <div className={`flex ${mine ? "justify-end" : "justify-start"} ${startsCluster ? "mt-3" : "mt-0.5"}`}>
                          <div
                            className={`max-w-[78%] px-3.5 py-2 text-[15px] leading-snug ${
                              mine ? "bg-primary text-primary-foreground" : "border border-border bg-card"
                            } ${
                              mine
                                ? `rounded-2xl ${startsCluster ? "" : "rounded-tr-md"} ${endsCluster ? "rounded-br-md" : "rounded-br-md"}`
                                : `rounded-2xl ${startsCluster ? "" : "rounded-tl-md"} ${endsCluster ? "rounded-bl-md" : "rounded-bl-md"}`
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            {endsCluster && <p className={`mt-1 text-right font-mono text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{msg.time}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={bottomRef} />
              {showJump && (
                <button
                  onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
                  aria-label="Jump to latest message"
                  className="sticky bottom-2 ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-lift"
                >
                  <ArrowDown size={18} />
                </button>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border bg-card px-3 pb-3 pt-2 md:px-6">
              <div className="mx-auto max-w-2xl">
                {selectedConv.messages.length < 3 && (
                  <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" aria-label="Quick replies">
                    {QUICK_REPLIES.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleSendMessage(q)}
                        className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-[13px] font-semibold transition-colors hover:border-primary hover:text-primary"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={taRef}
                    rows={1}
                    aria-label="Message"
                    placeholder="Write a message"
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      growTextarea();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
                  />
                  <Button size="icon" aria-label="Send message" onClick={() => handleSendMessage()} disabled={!messageInput.trim()}>
                    <Send size={18} />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-dots">
            <EmptyState art="chat" title="Pick a conversation">
              Your chats with taskers and posters live here.
            </EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}
