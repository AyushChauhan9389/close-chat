import { useCallback, useRef, useState } from 'react';
import type { User, Channel, ChannelMember } from '../lib/api';
import * as api from '../lib/api';
import { isWsConnected, sendWs } from '../lib/ws';
import {
  createChatMessage,
  getChannelDisplayName,
  getDateStr,
  getTimestamp,
  nextMessageId,
  type ChatMessage,
  type DisplayMode,
  type MessageType,
} from './chatUtils';

interface UseChatStateOptions {
  currentUser: User | null;
  displayMode: DisplayMode;
  setSidebarOpen: (open: boolean) => void;
}

export function useChatState({ currentUser, displayMode, setSidebarOpen }: UseChatStateOptions) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<number | string | null>(null);
  const activeChannel = channels.find((channel) => channel.id === activeChannelId) || null;

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const myRoleInChannel = channelMembers.find((member) => currentUser && member.id === currentUser.id)?.role || null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [oldestMessageApiId, setOldestMessageApiId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const activeChannelIdRef = useRef(activeChannelId);
  activeChannelIdRef.current = activeChannelId;

  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  const displayModeRef = useRef(displayMode);
  displayModeRef.current = displayMode;

  const addMessage = useCallback((
    username: string,
    text: string,
    type: MessageType = 'user',
    timestamp?: string,
    date?: string,
  ) => {
    setMessages((prev) => [...prev, createChatMessage(username, text, type, timestamp, date)]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const loadChannelMessages = useCallback(async (
    channel: Channel,
    options?: { markRead?: boolean },
  ) => {
    const shouldMarkRead = options?.markRead ?? true;

    if (shouldMarkRead) {
      api.markChannelRead(channel.id).catch(() => {});
      setChannels((prev) =>
        prev.map((existing) => (existing.id === channel.id ? { ...existing, unreadCount: 0 } : existing))
      );
    }

    if (isWsConnected()) {
      sendWs({ type: 'join-channel', channelId: channel.id });
    }

    setMessages([]);
    setHasMore(false);
    setOldestMessageApiId(null);
    setIsLoadingMore(false);

    const systemMsg: ChatMessage = {
      id: nextMessageId(),
      username: '',
      text: `system: switched to ${getChannelDisplayName(channel)}`,
      type: 'system',
      timestamp: getTimestamp(),
      date: getDateStr(),
    };

    try {
      const { messages: apiMessages, hasMore: initialHasMore } = await api.getMessages(channel.id, { limit: 50 });

      if (activeChannelIdRef.current !== channel.id) {
        return;
      }

      const chronological = [...apiMessages].reverse();
      const rendered: ChatMessage[] = chronological.map((message) => ({
        id: nextMessageId(),
        username: message.senderUsername || 'unknown',
        text: message.content || '',
        type: message.type || 'user',
        timestamp: getTimestamp(message.createdAt),
        date: getDateStr(message.createdAt),
      }));

      setMessages([systemMsg, ...rendered]);
      setHasMore(initialHasMore);
      setOldestMessageApiId(apiMessages.length > 0 ? String(apiMessages[apiMessages.length - 1].id) : null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      if (activeChannelIdRef.current !== channel.id) {
        return;
      }

      setMessages([
        systemMsg,
        createChatMessage('', `system: Failed to load messages: ${message}`, 'system'),
      ]);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      const [listedChannels, dms] = await Promise.all([api.listChannels(), api.listDms()]);

      const dmChannels: Channel[] = dms.map((dm) => ({
        id: dm.id,
        name: dm.name,
        type: dm.type,
        lastMessage: dm.lastMessage,
        unreadCount: dm.unreadCount,
        recipient: dm.recipient,
      }));

      const seenIds = new Set<number>();
      const merged: Channel[] = [];

      for (const channel of listedChannels) {
        if (!seenIds.has(channel.id)) {
          seenIds.add(channel.id);
          if (channel.type === 'dm') {
            const dmInfo = dms.find((dm) => dm.id === channel.id);
            if (dmInfo) channel.recipient = dmInfo.recipient;
          }
          merged.push(channel);
        }
      }

      for (const dm of dmChannels) {
        if (!seenIds.has(dm.id)) {
          seenIds.add(dm.id);
          merged.push(dm);
        }
      }

      setChannels(merged);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error('loadChannels failed:', message);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const users = await api.listUsers();
      setAllUsers(users);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error('loadUsers failed:', message);
    }
  }, []);

  const loadChannelMembers = useCallback(async () => {
    const channelId = activeChannelIdRef.current;
    if (!channelId) return;

    try {
      const members = await api.getChannelMembers(channelId);
      setChannelMembers(members);
    } catch {
      setChannelMembers([]);
    }
  }, []);

  const addMemberToActiveChannel = useCallback(async (user: User) => {
    const channelId = activeChannelIdRef.current;
    if (!channelId) return;

    try {
      await api.addMember(channelId, user.id);
      addMessage('', `system: @${user.username} added to the channel`, 'system');
      await loadChannelMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to add @${user.username}: ${message}`, 'system');
    }
  }, [addMessage, loadChannelMembers]);

  const addMemberByUsername = useCallback(async (username: string) => {
    const channelId = activeChannelIdRef.current;
    if (!channelId) return;

    try {
      const results = await api.searchUsers(username);
      const exact = results.find((user) => user.username.toLowerCase() === username.toLowerCase());
      if (!exact) {
        addMessage('', `system: User @${username} not found`, 'system');
        return;
      }

      await addMemberToActiveChannel(exact);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to add @${username}: ${message}`, 'system');
    }
  }, [addMemberToActiveChannel, addMessage]);

  const removeMemberFromActiveChannel = useCallback(async (username: string) => {
    const channelId = activeChannelIdRef.current;
    if (!channelId) return;

    try {
      const member = channelMembers.find(
        (channelMember) => channelMember.username.toLowerCase() === username.toLowerCase()
      );
      if (!member) {
        addMessage('', `system: @${username} is not a member of this channel`, 'system');
        return;
      }

      await api.removeMember(channelId, member.id);
      addMessage('', `system: @${member.username} removed from the channel`, 'system');
      await loadChannelMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to kick @${username}: ${message}`, 'system');
    }
  }, [addMessage, channelMembers, loadChannelMembers]);

  const switchToChannel = useCallback(async (channel: Channel) => {
    setActiveChannelId(channel.id);
    await loadChannelMessages(channel, { markRead: true });

    if (displayModeRef.current === 'compact') {
      setSidebarOpen(false);
    }
  }, [loadChannelMessages, setSidebarOpen]);

  const reloadActiveChannel = useCallback(async (options?: { markRead?: boolean }) => {
    const channelId = activeChannelIdRef.current;
    if (!channelId) return;

    const channel = channelsRef.current.find((existing) => existing.id === channelId);
    if (!channel) return;

    await loadChannelMessages(channel, options);
  }, [loadChannelMessages]);

  const loadMoreMessages = useCallback(async () => {
    const channelId = activeChannelIdRef.current;
    if (!channelId || !hasMore || isLoadingMore || !oldestMessageApiId) return;

    setIsLoadingMore(true);
    try {
      const { messages: apiMessages, hasMore: moreRemaining } =
        await api.getMessages(channelId, { limit: 50, before: oldestMessageApiId });

      if (activeChannelIdRef.current !== channelId) return;

      if (apiMessages.length === 0) {
        setHasMore(false);
        return;
      }

      const chronological = [...apiMessages].reverse();
      const newOldestApiId = String(apiMessages[apiMessages.length - 1].id);

      const rendered: ChatMessage[] = chronological.map((message) => ({
        id: nextMessageId(),
        username: message.senderUsername || 'unknown',
        text: message.content || '',
        type: message.type || 'user',
        timestamp: getTimestamp(message.createdAt),
        date: getDateStr(message.createdAt),
      }));

      setMessages((prev) => {
        const [systemMessage, ...rest] = prev;
        return systemMessage ? [systemMessage, ...rendered, ...rest] : [...rendered, ...rest];
      });
      setHasMore(moreRemaining);
      setOldestMessageApiId(newOldestApiId);
    } catch (err) {
      console.error('loadMoreMessages failed:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, oldestMessageApiId]);

  const sendChatMessage = useCallback((text: string) => {
    const channelId = activeChannelIdRef.current;
    if (!channelId) {
      addMessage('', 'system: No channel selected. Use /join <channel> or pick one from sidebar.', 'system');
      return;
    }

    const user = currentUserRef.current;
    const displayName = user ? `@${user.username}` : '@anon';
    addMessage(displayName, text, 'user');

    if (isWsConnected()) {
      sendWs({
        type: 'message',
        channelId,
        content: text,
      });
    } else {
      api.sendMessage(channelId, text).catch((err: Error) => {
        addMessage('', `system: Failed to send: ${err.message}`, 'system');
      });
    }
  }, [addMessage]);

  return {
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
    hasMore,
    isLoadingMore,
    loadMoreMessages,
    loadChannels,
    loadUsers,
    loadChannelMembers,
    addMemberByUsername,
    addMemberToActiveChannel,
    removeMemberFromActiveChannel,
    switchToChannel,
    reloadActiveChannel,
    sendChatMessage,
    currentUserRef,
    activeChannelIdRef,
    channelsRef,
  };
}
