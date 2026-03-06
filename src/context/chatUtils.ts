import type { Channel } from '../lib/api';

export type MessageType = 'user' | 'bot' | 'system';

export type UsernameStyle =
  | 'geist-square'
  | 'geist-grid'
  | 'geist-circle'
  | 'geist-triangle'
  | 'geist-line'
  | 'traditional';

export type DisplayMode = 'compact' | 'fullscreen';

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  type: MessageType;
  timestamp: string;
  date: string;
}

let msgIdCounter = 0;

export function getTimestamp(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function getDateStr(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function nextMessageId(): string {
  msgIdCounter += 1;
  return String(msgIdCounter);
}

export function createChatMessage(
  username: string,
  text: string,
  type: MessageType = 'user',
  timestamp?: string,
  date?: string,
): ChatMessage {
  return {
    id: nextMessageId(),
    username,
    text,
    type,
    timestamp: timestamp || getTimestamp(),
    date: date || getDateStr(),
  };
}

export function getChannelDisplayName(channel: Channel): string {
  return channel.type === 'dm'
    ? (channel.recipient ? `@${channel.recipient.username}` : `@${channel.name}`)
    : `#${channel.name}`;
}
