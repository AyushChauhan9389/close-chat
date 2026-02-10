// ── WebSocket client for close-chat ──
// Connects to wss://api.t-bash.space/ws?token=...

import { getWebSocketUrl } from './api';

export type WsMessageType =
  | 'message'            // new chat message
  | 'connected'          // server auth confirmed
  | 'user-joined'        // user joined a channel
  | 'user-left'          // user left a channel
  | 'status-changed'     // user status change (online/idle/offline)
  | 'user-typing'        // user is typing
  | 'user-stopped-typing'
  | 'joined-channel'     // ack for joining a channel
  | 'presence'           // synthetic: emitted locally on ws open
  | 'channel_update'     // channel metadata changed
  | 'error';             // server error

export interface WsIncomingMessage {
  type: WsMessageType;
  data: any;
}

export interface WsOutgoingMessage {
  type: 'message' | 'typing-start' | 'typing-stop' | 'join-channel' | 'leave-channel' | 'status-update';
  [key: string]: any;
}

type WsHandler = (msg: WsIncomingMessage) => void;

let _ws: WebSocket | null = null;
let _handlers: Map<WsMessageType | '*', WsHandler[]> = new Map();
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;
let _intentionalClose = false;

// ── Connect ──
export function connectWs(): void {
  if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  _intentionalClose = false;
  const url = getWebSocketUrl();
  _ws = new WebSocket(url);

  _ws.onopen = () => {
    _reconnectAttempts = 0;
    emit({ type: 'presence', data: { status: 'connected' } });
  };

  _ws.onmessage = (event) => {
    try {
      const raw = JSON.parse(event.data);
      // Server sends flat JSON with `type` at top level.
      // Normalize into { type, data } so handlers can use msg.data consistently.
      const type = raw.type as WsMessageType;
      emit({ type, data: raw });
    } catch {
      // Non-JSON messages ignored
    }
  };

  _ws.onclose = () => {
    _ws = null;
    if (!_intentionalClose) {
      scheduleReconnect();
    }
  };

  _ws.onerror = () => {
    // onclose will fire after onerror
  };
}

// ── Disconnect ──
export function disconnectWs(): void {
  _intentionalClose = true;
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
  if (_ws) {
    _ws.close();
    _ws = null;
  }
}

// ── Send ──
export function sendWs(msg: WsOutgoingMessage): void {
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify(msg));
  }
}

// ── Event system ──
function emit(msg: WsIncomingMessage): void {
  // Type-specific handlers
  const typeHandlers = _handlers.get(msg.type);
  if (typeHandlers) {
    typeHandlers.forEach((h) => h(msg));
  }
  // Wildcard handlers
  const wildcardHandlers = _handlers.get('*');
  if (wildcardHandlers) {
    wildcardHandlers.forEach((h) => h(msg));
  }
}

export function onWs(type: WsMessageType | '*', handler: WsHandler): () => void {
  if (!_handlers.has(type)) {
    _handlers.set(type, []);
  }
  _handlers.get(type)!.push(handler);

  // Return unsubscribe function
  return () => {
    const arr = _handlers.get(type);
    if (arr) {
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    }
  };
}

// ── Reconnect with exponential backoff ──
function scheduleReconnect(): void {
  const delay = Math.min(1000 * Math.pow(2, _reconnectAttempts), MAX_RECONNECT_DELAY);
  _reconnectAttempts++;
  _reconnectTimer = setTimeout(() => {
    connectWs();
  }, delay);
}

// ── Status ──
export function isWsConnected(): boolean {
  return _ws !== null && _ws.readyState === WebSocket.OPEN;
}
