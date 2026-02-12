import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, Channel, ChannelMember } from '../lib/api';
import * as api from '../lib/api';
import { connectWs, disconnectWs, sendWs, onWs, isWsConnected } from '../lib/ws';

// ── Message types for the chat area ──
export type MessageType = 'user' | 'bot' | 'system';

export type UsernameStyle = 'geist-square' | 'geist-grid' | 'geist-circle' | 'geist-triangle' | 'geist-line' | 'traditional';

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  type: MessageType;
  timestamp: string;
}

// ── Context shape ──
interface AppContextValue {
  // Auth
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAuthenticated: boolean;

  // Theme
  isDark: boolean;
  toggleTheme: () => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // People panel
  peopleOpen: boolean;
  setPeopleOpen: (open: boolean) => void;
  togglePeople: () => void;

  // Channels
  channels: Channel[];
  setChannels: (channels: Channel[]) => void;
  activeChannelId: number | string | null;
  setActiveChannelId: (id: number | string | null) => void;
  activeChannel: Channel | null;

  // Users & Members
  allUsers: User[];
  setAllUsers: (users: User[]) => void;
  channelMembers: ChannelMember[];
  setChannelMembers: (members: ChannelMember[]) => void;
  myRoleInChannel: 'admin' | 'member' | null;

  // Messages
  messages: ChatMessage[];
  addMessage: (username: string, text: string, type?: MessageType, timestamp?: string) => void;
  clearMessages: () => void;

  // Channel operations
  loadChannels: () => Promise<void>;
  loadUsers: () => Promise<void>;
  loadChannelMembers: () => Promise<void>;
  switchToChannel: (ch: Channel) => Promise<void>;

  // WebSocket
  initApp: () => Promise<void>;
  sendChatMessage: (text: string) => void;

  // Settings
  usernameStyle: UsernameStyle;
  setUsernameStyle: (style: UsernameStyle) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// ── Helper ──
function getTimestamp(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

let msgIdCounter = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  // Auth
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isAuthenticated = currentUser !== null;

  // Theme
  const [isDark, setIsDark] = useState(true);
  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.body.classList.remove('light');
      } else {
        document.body.classList.add('light');
      }
      return next;
    });
  }, []);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      document.body.classList.toggle('sidebar-open', next);
      return next;
    });
  }, []);

  // People panel
  const [peopleOpen, setPeopleOpen] = useState(false);
  const togglePeople = useCallback(() => {
    setPeopleOpen((prev) => {
      const next = !prev;
      if (next) {
        document.body.classList.add('people-open');
      } else {
        document.body.classList.remove('people-open');
      }
      return next;
    });
  }, []);

  // Channels
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<number | string | null>(null);
  const activeChannel = channels.find((c) => c.id === activeChannelId) || null;

  // Users & Members
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const myRoleInChannel = channelMembers.find((m) => currentUser && m.id === currentUser.id)?.role || null;

  // Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Settings
  const [usernameStyle, setUsernameStyleState] = useState<UsernameStyle>(() => {
    return (localStorage.getItem('closechat_username_style') as UsernameStyle) || 'geist-square';
  });

  const setUsernameStyle = useCallback((style: UsernameStyle) => {
    setUsernameStyleState(style);
    localStorage.setItem('closechat_username_style', style);
  }, []);

  const addMessage = useCallback((username: string, text: string, type: MessageType = 'user', timestamp?: string) => {
    const msg: ChatMessage = {
      id: String(++msgIdCounter),
      username,
      text,
      type,
      timestamp: timestamp || getTimestamp(),
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Refs for stable access in WS handlers
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const activeChannelIdRef = useRef(activeChannelId);
  activeChannelIdRef.current = activeChannelId;
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const allUsersRef = useRef(allUsers);
  allUsersRef.current = allUsers;

  // ── Channel operations ──
  const loadChannels = useCallback(async () => {
    try {
      const [chans, dms] = await Promise.all([api.listChannels(), api.listDms()]);

      const dmChannels: Channel[] = dms.map((dm) => ({
        id: dm.id,
        name: dm.name,
        type: dm.type,
        lastMessage: dm.lastMessage,
        unreadCount: dm.unreadCount,
        recipient: dm.recipient,
      }));

      const allIds = new Set<number>();
      const merged: Channel[] = [];

      for (const ch of chans) {
        if (!allIds.has(ch.id)) {
          allIds.add(ch.id);
          if (ch.type === 'dm') {
            const dmInfo = dms.find((d) => d.id === ch.id);
            if (dmInfo) ch.recipient = dmInfo.recipient;
          }
          merged.push(ch);
        }
      }

      for (const dm of dmChannels) {
        if (!allIds.has(dm.id)) {
          allIds.add(dm.id);
          merged.push(dm);
        }
      }

      setChannels(merged);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to load channels: ${message}`, 'system');
    }
  }, [addMessage]);

  const loadUsers = useCallback(async () => {
    try {
      const users = await api.listUsers();
      setAllUsers(users);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to load users: ${message}`, 'system');
    }
  }, [addMessage]);

  const loadChannelMembers = useCallback(async () => {
    const chId = activeChannelIdRef.current;
    if (!chId) return;
    try {
      const members = await api.getChannelMembers(chId);
      setChannelMembers(members);
    } catch {
      setChannelMembers([]);
    }
  }, []);

  const switchToChannel = useCallback(async (ch: Channel) => {
    setActiveChannelId(ch.id);

    // Mark as read
    api.markChannelRead(ch.id).catch(() => {});

    // Subscribe via WebSocket
    if (isWsConnected()) {
      sendWs({ type: 'join-channel', channelId: ch.id });
    }

    // Clear and load messages
    setMessages([]);

    const displayName = ch.type === 'dm'
      ? (ch.recipient ? `@${ch.recipient.username}` : `@${ch.name}`)
      : `#${ch.name}`;

    const systemMsg: ChatMessage = {
      id: String(++msgIdCounter),
      username: '',
      text: `system: switched to ${displayName}`,
      type: 'system',
      timestamp: getTimestamp(),
    };

    try {
      const apiMessages = await api.getMessages(ch.id, { limit: 50 });
      const chronological = [...apiMessages].reverse();
      const rendered: ChatMessage[] = chronological.map((msg) => ({
        id: String(++msgIdCounter),
        username: msg.senderUsername || 'unknown',
        text: msg.content || '',
        type: msg.type || 'user',
        timestamp: getTimestamp(msg.createdAt),
      }));
      setMessages([systemMsg, ...rendered]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      setMessages([
        systemMsg,
        {
          id: String(++msgIdCounter),
          username: '',
          text: `system: Failed to load messages: ${message}`,
          type: 'system',
          timestamp: getTimestamp(),
        },
      ]);
    }

    // Close sidebar on mobile after switching
    setSidebarOpen(false);
    document.body.classList.remove('sidebar-open');
  }, []);

  // ── Send message ──
  const sendChatMessage = useCallback((text: string) => {
    const chId = activeChannelIdRef.current;
    if (!chId) {
      addMessage('', 'system: No channel selected. Use /join <channel> or pick one from sidebar.', 'system');
      return;
    }

    const user = currentUserRef.current;
    const displayName = user ? `@${user.username}` : '@anon';

    // Optimistic UI
    addMessage(displayName, text, 'user');

    if (isWsConnected()) {
      sendWs({
        type: 'message',
        channelId: chId,
        content: text,
      });
    } else {
      api.sendMessage(chId, text).catch((err: Error) => {
        addMessage('', `system: Failed to send: ${err.message}`, 'system');
      });
    }
  }, [addMessage]);

  // ── WebSocket handlers ──
  const wsSetupRef = useRef(false);

  const initApp = useCallback(async () => {
    if (!wsSetupRef.current) {
      wsSetupRef.current = true;

      onWs('message', (msg) => {
        const data = msg.data;
        const channelId = data.channelId as number | string;
        const senderId = data.senderId as number;
        const senderUsername = (data.senderUsername as string) || 'unknown';
        const content = (data.content as string) || '';
        const ts = (data.timestamp as string) || (data.createdAt as string);

        if (channelId === activeChannelIdRef.current) {
          const user = currentUserRef.current;
          if (!user || senderId !== user.id) {
            const timeStr = ts ? getTimestamp(ts) : undefined;
            addMessage(senderUsername, content, (data.messageType as MessageType) || 'user', timeStr);
          }
        }

        // Update sidebar unread for non-active channels
        if (channelId !== activeChannelIdRef.current) {
          setChannels((prev) =>
            prev.map((c) => {
              if (c.id === channelId) {
                return {
                  ...c,
                  unreadCount: (c.unreadCount || 0) + 1,
                  lastMessage: {
                    content,
                    senderId,
                    senderUsername,
                    createdAt: ts || new Date().toISOString(),
                  },
                };
              }
              return c;
            })
          );
        }
      });

      onWs('presence', (msg) => {
        const data = msg.data;
        if (data.status === 'connected') {
          addMessage('', 'system: connected to mesh', 'system');
          api.updateMe({ status: 'online' }).catch(() => {});
        }
      });

      onWs('connected', () => {
        channelsRef.current.forEach((ch) => {
          sendWs({ type: 'join-channel', channelId: ch.id });
        });
      });

      onWs('status-changed', (msg) => {
        const data = msg.data;
        if (data.userId) {
          setAllUsers((prev) =>
            prev.map((u) =>
              u.id === (data.userId as number) ? { ...u, status: data.status as string } : u
            )
          );
        }
      });

      onWs('user-joined', (msg) => {
        const data = msg.data;
        if (data.channelId === activeChannelIdRef.current) {
          const username = (data.user as { username: string })?.username || (data.username as string) || 'unknown';
          addMessage('', `system: @${username} joined`, 'system');
        }
      });

      onWs('user-left', (msg) => {
        const data = msg.data;
        if (data.channelId === activeChannelIdRef.current) {
          addMessage('', 'system: user left', 'system');
        }
      });

      onWs('channel_update', () => {
        loadChannels();
      });
    }

    connectWs();
    await Promise.all([loadChannels(), loadUsers()]);
  }, [addMessage, loadChannels, loadUsers]);

  // ── Idle/online on focus/blur ──
  useEffect(() => {
    const handleBlur = () => {
      if (currentUserRef.current) {
        api.updateMe({ status: 'idle' }).catch(() => {});
      }
    };
    const handleFocus = () => {
      if (currentUserRef.current) {
        api.updateMe({ status: 'online' }).catch(() => {});
      }
    };
    const handleUnload = () => {
      if (currentUserRef.current) {
        api.updateMe({ status: 'offline' }).catch(() => {});
      }
      disconnectWs();
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // Periodic user refresh
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      loadUsers();
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, loadUsers]);

  const value: AppContextValue = {
    currentUser,
    setCurrentUser,
    isAuthenticated,
    isDark,
    toggleTheme,
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    peopleOpen,
    setPeopleOpen,
    togglePeople,
    channels,
    setChannels,
    activeChannelId,
    setActiveChannelId,
    activeChannel,
    allUsers,
    setAllUsers,
    channelMembers,
    setChannelMembers,
    myRoleInChannel,
    messages,
    addMessage,
    clearMessages,
    loadChannels,
    loadUsers,
    loadChannelMembers,
    switchToChannel,
    initApp,
    sendChatMessage,
    usernameStyle,
    setUsernameStyle,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
