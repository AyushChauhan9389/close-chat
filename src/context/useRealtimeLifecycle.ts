import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Channel, User } from '../lib/api';
import * as api from '../lib/api';
import { connectWs, disconnectWs, isWsConnected, onWs, sendWs } from '../lib/ws';
import { getTimestamp, type MessageType } from './chatUtils';

interface UseRealtimeLifecycleOptions {
  isAuthenticated: boolean;
  currentUserRef: MutableRefObject<User | null>;
  activeChannelIdRef: MutableRefObject<number | string | null>;
  channelsRef: MutableRefObject<Channel[]>;
  addMessage: (username: string, text: string, type?: MessageType, timestamp?: string, date?: string) => void;
  loadChannels: () => Promise<void>;
  loadUsers: () => Promise<void>;
  setChannels: Dispatch<SetStateAction<Channel[]>>;
  setAllUsers: Dispatch<SetStateAction<User[]>>;
}

export function useRealtimeLifecycle({
  isAuthenticated,
  currentUserRef,
  activeChannelIdRef,
  channelsRef,
  addMessage,
  loadChannels,
  loadUsers,
  setChannels,
  setAllUsers,
}: UseRealtimeLifecycleOptions) {
  const wsSetupRef = useRef(false);
  const unsubscribeHandlersRef = useRef<Array<() => void>>([]);

  const initApp = useCallback(async () => {
    if (!wsSetupRef.current) {
      wsSetupRef.current = true;

      unsubscribeHandlersRef.current = [
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
              const messageId = data.id as number;

              if (isWsConnected()) {
                sendWs({ type: 'mark-read', channelId, messageId });
              } else {
                api.markChannelRead(channelId).catch(() => {});
              }

              setChannels((prev) =>
                prev.map((channel) => (channel.id === channelId ? { ...channel, unreadCount: 0 } : channel))
              );
            }
          }

          if (channelId !== activeChannelIdRef.current) {
            setChannels((prev) =>
              prev.map((channel) => {
                if (channel.id === channelId) {
                  return {
                    ...channel,
                    unreadCount: (channel.unreadCount || 0) + 1,
                    lastMessage: {
                      content,
                      senderId,
                      senderUsername,
                      createdAt: ts || new Date().toISOString(),
                    },
                  };
                }
                return channel;
              })
            );
          }
        }),
        onWs('presence', (msg) => {
          const data = msg.data;
          if (data.status === 'connected') {
            addMessage('', 'system: connected to mesh', 'system');
            api.updateMe({ status: 'online' }).catch(() => {});
          }
        }),
        onWs('connected', () => {
          channelsRef.current.forEach((channel) => {
            sendWs({ type: 'join-channel', channelId: channel.id });
          });
        }),
        onWs('status-changed', (msg) => {
          const data = msg.data;
          if (data.userId) {
            setAllUsers((prev) =>
              prev.map((user) =>
                user.id === (data.userId as number) ? { ...user, status: data.status as string } : user
              )
            );
          }
        }),
        onWs('user-joined', (msg) => {
          const data = msg.data;
          if (data.channelId === activeChannelIdRef.current) {
            const username = (data.user as { username: string })?.username || (data.username as string) || 'unknown';
            addMessage('', `system: @${username} joined`, 'system');
          }
        }),
        onWs('user-left', (msg) => {
          const data = msg.data;
          if (data.channelId === activeChannelIdRef.current) {
            addMessage('', 'system: user left', 'system');
          }
        }),
        onWs('channel_update', () => {
          loadChannels();
        }),
      ];
    }

    connectWs();
    await Promise.all([loadChannels(), loadUsers()]);
  }, [
    activeChannelIdRef,
    addMessage,
    channelsRef,
    currentUserRef,
    loadChannels,
    loadUsers,
    setAllUsers,
    setChannels,
  ]);

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
  }, [currentUserRef]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      loadUsers();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, loadUsers]);

  useEffect(() => {
    return () => {
      unsubscribeHandlersRef.current.forEach((unsubscribe) => unsubscribe());
      disconnectWs();
    };
  }, []);

  return { initApp };
}
