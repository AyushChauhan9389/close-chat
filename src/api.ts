// ── API Client for close-chat ──
// Base URL: https://api.t-bash.space

const BASE_URL = "https://api.t-bash.space";

// ── Types ──
export interface User {
  id: number;
  username: string;
  email?: string;
  status: string;
  isBot?: boolean;
  lastSeen?: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ChannelLastMessage {
  content: string;
  senderId: number;
  senderUsername: string;
  createdAt: string;
}

export interface Channel {
  id: number;
  name: string;
  type: "channel" | "dm";
  createdBy?: number;
  createdAt?: string;
  lastMessage?: ChannelLastMessage | null;
  unreadCount?: number;
  members?: number[];
  role?: "admin" | "member";
}

export interface ChannelMember {
  id: number;
  username: string;
  status: string;
  isBot?: boolean;
  role: "admin" | "member";
  joinedAt?: string;
}

export interface Invite {
  id: number;
  code: string;
  channelId?: number;
  createdBy: { id: number; username: string } | number;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  isActive?: boolean;
  createdAt: string;
}

export interface Message {
  id: number;
  channelId: number;
  senderId: number;
  senderUsername: string;
  content: string | null;
  type: "user" | "bot" | "system";
  imageUrl?: string | null;
  createdAt: string;
}

export interface ApiError {
  error: string;
}

// ── Token management ──
let _token: string | null = null;

export function getToken(): string | null {
  if (_token) return _token;
  _token = localStorage.getItem("bitchat_token");
  return _token;
}

export function setToken(token: string): void {
  _token = token;
  localStorage.setItem("bitchat_token", token);
}

export function clearToken(): void {
  _token = null;
  localStorage.removeItem("bitchat_token");
}

// ── Fetch wrapper ──
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as ApiError;
      if (body.error) errMsg = body.error;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(errMsg);
  }

  // Some endpoints may return empty body (204 etc)
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// ══════════════════════════════════════
// Auth endpoints
// ══════════════════════════════════════

export async function signup(
  username: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
  setToken(data.token);
  return data;
}

export async function login(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data;
}

export async function verifyToken(): Promise<User> {
  const data = await apiFetch<{ user: User }>("/api/auth/verify");
  return data.user;
}

// ══════════════════════════════════════
// Users endpoints
// ══════════════════════════════════════

export async function listUsers(): Promise<User[]> {
  const data = await apiFetch<{ users: User[]; onlineCount: number }>("/api/users/");
  return data.users || [];
}

export async function getMe(): Promise<User> {
  const data = await apiFetch<{ user: User }>("/api/users/me");
  return data.user;
}

export async function updateMe(opts: {
  username?: string;
  status?: "online" | "idle" | "offline";
}): Promise<User> {
  const data = await apiFetch<{ user: User }>("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(opts),
  });
  return data.user;
}

export async function getUserById(id: number | string): Promise<User> {
  const data = await apiFetch<{ user: User }>(`/api/users/${id}`);
  return data.user;
}

export async function searchUsers(query: string): Promise<User[]> {
  const params = new URLSearchParams({ q: query });
  const data = await apiFetch<{ users: User[] }>(`/api/users/search?${params.toString()}`);
  return data.users || [];
}

// ══════════════════════════════════════
// Channels endpoints
// ══════════════════════════════════════

export async function listChannels(): Promise<Channel[]> {
  const data = await apiFetch<{ channels: Channel[] }>("/api/channels/");
  return data.channels || [];
}

export async function createChannel(
  name: string,
  type: "channel" | "dm",
  members?: number[],
): Promise<Channel> {
  const data = await apiFetch<{ channel: Channel }>("/api/channels/", {
    method: "POST",
    body: JSON.stringify({ name, type, members }),
  });
  return data.channel;
}

export async function getChannel(id: number | string): Promise<Channel> {
  const data = await apiFetch<{ channel: Channel }>(`/api/channels/${id}`);
  return data.channel;
}

export async function joinChannel(id: number | string): Promise<void> {
  await apiFetch<void>(`/api/channels/${id}/join`, { method: "POST" });
}

export async function leaveChannel(id: number | string): Promise<void> {
  await apiFetch<void>(`/api/channels/${id}/leave`, { method: "POST" });
}

export async function getChannelMembers(
  id: number | string,
): Promise<ChannelMember[]> {
  const data = await apiFetch<{ members: ChannelMember[] }>(`/api/channels/${id}/members`);
  return data.members || [];
}

// ── Join by invite code ──
export async function joinByInviteCode(code: string): Promise<Channel> {
  const data = await apiFetch<{ channel: Channel }>(`/api/channels/join/invite/${encodeURIComponent(code)}`, {
    method: "POST",
  });
  return data.channel;
}

// ── Admin: add member ──
export async function addMember(
  channelId: number | string,
  userId: number,
): Promise<void> {
  await apiFetch<void>(`/api/channels/${channelId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

// ── Admin: remove member ──
export async function removeMember(
  channelId: number | string,
  userId: number | string,
): Promise<void> {
  await apiFetch<void>(`/api/channels/${channelId}/members/${userId}`, {
    method: "DELETE",
  });
}

// ── Admin: create invite ──
export async function createInvite(
  channelId: number | string,
  options?: { maxUses?: number; expiresInHours?: number },
): Promise<Invite> {
  const data = await apiFetch<{ invite: Invite }>(`/api/channels/${channelId}/invites`, {
    method: "POST",
    body: JSON.stringify(options || {}),
  });
  return data.invite;
}

// ── Admin: list invites ──
export async function listInvites(
  channelId: number | string,
): Promise<Invite[]> {
  const data = await apiFetch<{ invites: Invite[] }>(`/api/channels/${channelId}/invites`);
  return data.invites || [];
}

// ── Admin: revoke invite ──
export async function revokeInvite(
  channelId: number | string,
  inviteId: number | string,
): Promise<void> {
  await apiFetch<void>(`/api/channels/${channelId}/invites/${inviteId}`, {
    method: "DELETE",
  });
}

// ══════════════════════════════════════
// Messages endpoints
// ══════════════════════════════════════

export async function getMessages(
  channelId: number | string,
  options?: { limit?: number; before?: string },
): Promise<Message[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.before) params.set("before", options.before);
  const qs = params.toString();
  const path = `/api/channels/${channelId}/messages${qs ? "?" + qs : ""}`;
  const data = await apiFetch<{ messages: Message[]; hasMore: boolean }>(path);
  return data.messages || [];
}

export async function sendMessage(
  channelId: number | string,
  content: string,
  type?: "user" | "bot" | "system",
): Promise<Message> {
  const body: Record<string, string> = { content };
  if (type) body.type = type;
  const data = await apiFetch<{ message: Message }>(`/api/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.message;
}

export async function markChannelRead(id: number | string): Promise<void> {
  await apiFetch<void>(`/api/channels/${id}/read`, { method: "POST" });
}

// ── WebSocket URL helper ──
export function getWebSocketUrl(): string {
  const token = getToken();
  // Convert https to wss
  const wsBase = BASE_URL.replace(/^http/, "ws");
  return `${wsBase}/ws?token=${encodeURIComponent(token || "")}`;
}
