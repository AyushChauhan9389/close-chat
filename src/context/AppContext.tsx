import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Channel, ChannelMember } from '../lib/api';
import { useChatState } from './useChatState';
import { useRealtimeLifecycle } from './useRealtimeLifecycle';
import { useUiState } from './useUiState';
import type { ChatMessage, DisplayMode, MessageType, UsernameStyle } from './chatUtils';
export type { ChatMessage, DisplayMode, MessageType, UsernameStyle } from './chatUtils';

// ── Context shape ──
interface AppContextValue {
  // Auth
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAuthenticated: boolean;

  // Theme
  isDark: boolean;
  toggleTheme: () => void;

  // Minimized state
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;
  prevDisplayMode: DisplayMode;
  setPrevDisplayMode: (mode: DisplayMode) => void;

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
  addMessage: (username: string, text: string, type?: MessageType, timestamp?: string, date?: string) => void;
  clearMessages: () => void;

  // Pagination
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreMessages: () => Promise<void>;

  // Channel operations
  loadChannels: () => Promise<void>;
  loadUsers: () => Promise<void>;
  loadChannelMembers: () => Promise<void>;
  addMemberByUsername: (username: string) => Promise<void>;
  addMemberToActiveChannel: (user: User) => Promise<void>;
  removeMemberFromActiveChannel: (username: string) => Promise<void>;
  switchToChannel: (ch: Channel) => Promise<void>;
  reloadActiveChannel: (options?: { markRead?: boolean }) => Promise<void>;

  // WebSocket
  initApp: () => Promise<void>;
  sendChatMessage: (text: string) => void;

  // Settings
  usernameStyle: UsernameStyle;
  setUsernameStyle: (style: UsernameStyle) => void;
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isAuthenticated = currentUser !== null;

  const uiState = useUiState();
  const chatState = useChatState({
    currentUser,
    displayMode: uiState.displayMode,
    setSidebarOpen: uiState.setSidebarOpen,
  });
  const { initApp } = useRealtimeLifecycle({
    isAuthenticated,
    currentUserRef: chatState.currentUserRef,
    activeChannelIdRef: chatState.activeChannelIdRef,
    channelsRef: chatState.channelsRef,
    addMessage: chatState.addMessage,
    loadChannels: chatState.loadChannels,
    loadUsers: chatState.loadUsers,
    setChannels: chatState.setChannels,
    setAllUsers: chatState.setAllUsers,
    isMinimized: uiState.isMinimized,
    reloadActiveChannel: chatState.reloadActiveChannel,
  });

  const value = useMemo<AppContextValue>(() => ({
    currentUser,
    setCurrentUser,
    isAuthenticated,
    isDark: uiState.isDark,
    toggleTheme: uiState.toggleTheme,
    isMinimized: uiState.isMinimized,
    setIsMinimized: uiState.setIsMinimized,
    prevDisplayMode: uiState.prevDisplayMode,
    setPrevDisplayMode: uiState.setPrevDisplayMode,
    sidebarOpen: uiState.sidebarOpen,
    setSidebarOpen: uiState.setSidebarOpen,
    toggleSidebar: uiState.toggleSidebar,
    peopleOpen: uiState.peopleOpen,
    setPeopleOpen: uiState.setPeopleOpen,
    togglePeople: uiState.togglePeople,
    channels: chatState.channels,
    setChannels: chatState.setChannels,
    activeChannelId: chatState.activeChannelId,
    setActiveChannelId: chatState.setActiveChannelId,
    activeChannel: chatState.activeChannel,
    allUsers: chatState.allUsers,
    setAllUsers: chatState.setAllUsers,
    channelMembers: chatState.channelMembers,
    setChannelMembers: chatState.setChannelMembers,
    myRoleInChannel: chatState.myRoleInChannel,
    messages: chatState.messages,
    addMessage: chatState.addMessage,
    clearMessages: chatState.clearMessages,
    hasMore: chatState.hasMore,
    isLoadingMore: chatState.isLoadingMore,
    loadMoreMessages: chatState.loadMoreMessages,
    loadChannels: chatState.loadChannels,
    loadUsers: chatState.loadUsers,
    loadChannelMembers: chatState.loadChannelMembers,
    addMemberByUsername: chatState.addMemberByUsername,
    addMemberToActiveChannel: chatState.addMemberToActiveChannel,
    removeMemberFromActiveChannel: chatState.removeMemberFromActiveChannel,
    switchToChannel: chatState.switchToChannel,
    reloadActiveChannel: chatState.reloadActiveChannel,
    initApp,
    sendChatMessage: chatState.sendChatMessage,
    usernameStyle: uiState.usernameStyle,
    setUsernameStyle: uiState.setUsernameStyle,
    displayMode: uiState.displayMode,
    setDisplayMode: uiState.setDisplayMode,
  }), [chatState, currentUser, initApp, isAuthenticated, uiState]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
