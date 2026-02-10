import './index.css';
import * as api from './api';
import { connectWs, disconnectWs, sendWs, onWs, isWsConnected } from './ws';
import type { User, Channel, Message, ChannelMember, Invite } from './api';

declare global {
  interface Window {
    electronAPI: {
      setMovable: (movable: boolean) => void;
      setIgnoreMouseEvents: (ignore: boolean, opts?: { forward: boolean }) => void;
    };
  }
}

// ── Click-through for transparent regions ──
// forward: true only works on macOS; on Windows the window becomes fully click-through
// with no way to recover, so we skip click-through on non-macOS platforms.
const contentWrapper = document.getElementById('contentWrapper') as HTMLElement;
const isMac = navigator.platform.toLowerCase().includes('mac');

if (isMac) {
  window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  contentWrapper.addEventListener('mouseenter', () => {
    window.electronAPI.setIgnoreMouseEvents(false);
  });
  contentWrapper.addEventListener('mouseleave', () => {
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
  });
}

// ── Middle-click drag support ──
window.addEventListener('mousedown', (e) => {
  if (e.button === 1) window.electronAPI.setMovable(true);
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 1) window.electronAPI.setMovable(false);
});
window.addEventListener('contextmenu', (e) => {
  if (e.button === 1) e.preventDefault();
});

// ── DOM refs: Auth ──
const authOverlay = document.getElementById('authOverlay') as HTMLElement;
const loginForm = document.getElementById('loginForm') as HTMLElement;
const signupForm = document.getElementById('signupForm') as HTMLElement;
const loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
const signupBtn = document.getElementById('signupBtn') as HTMLButtonElement;
const showSignupBtn = document.getElementById('showSignup') as HTMLButtonElement;
const showLoginBtn = document.getElementById('showLogin') as HTMLButtonElement;
const loginUser = document.getElementById('loginUser') as HTMLInputElement;
const loginPass = document.getElementById('loginPass') as HTMLInputElement;
const loginError = document.getElementById('loginError') as HTMLElement;
const signupUser = document.getElementById('signupUser') as HTMLInputElement;
const signupEmail = document.getElementById('signupEmail') as HTMLInputElement;
const signupPass = document.getElementById('signupPass') as HTMLInputElement;
const signupConfirm = document.getElementById('signupConfirm') as HTMLInputElement;
const signupError = document.getElementById('signupError') as HTMLElement;

// ── DOM refs: App ──
const appContainer = document.getElementById('appContainer') as HTMLElement;
const chatArea = document.getElementById('chatArea') as HTMLElement;
const messageInput = document.getElementById('messageInput') as HTMLInputElement;
const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement;
const themeIcon = document.getElementById('themeIcon') as HTMLSpanElement;
const hamburgerBtn = document.getElementById('hamburgerBtn') as HTMLButtonElement;
const chatList = document.getElementById('chatList') as HTMLElement;
const peopleToggle = document.getElementById('peopleToggle') as HTMLElement;
const peopleList = document.getElementById('peopleList') as HTMLElement;
const peopleCountEl = document.getElementById('peopleCount') as HTMLElement;
const userCountEl = document.getElementById('userCount') as HTMLElement;

// ── State ──
let currentUser: User | null = null;
let isDark = true;
let sidebarOpen = false;
let peopleOpen = false;
let channels: Channel[] = [];
let activeChannelId: number | string | null = null;
let allUsers: User[] = [];
let channelMembers: ChannelMember[] = [];
let myRoleInChannel: 'admin' | 'member' | null = null;

// Hide app until authenticated
appContainer.style.display = 'none';

const brandEl = document.querySelector('.brand') as HTMLElement;

// ══════════════════════════════════════
// Auth Logic
// ══════════════════════════════════════

function showAuthError(el: HTMLElement, msg: string): void {
  el.textContent = `*** ${msg}`;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

function dismissAuth(user: User): void {
  currentUser = user;

  if (brandEl) {
    brandEl.innerHTML = `bitchat / <span class="username">@${user.username}</span>`;
  }

  // Fade out overlay, reveal app
  authOverlay.style.transition = 'opacity 0.3s ease';
  authOverlay.style.opacity = '0';
  setTimeout(() => {
    authOverlay.classList.add('hidden');
    appContainer.style.display = 'flex';
    messageInput.focus();
    initApp();
  }, 300);
}

// Switch between login / signup
showSignupBtn.addEventListener('click', () => {
  loginForm.style.display = 'none';
  signupForm.style.display = 'flex';
  loginError.textContent = '';
  signupUser.focus();
});

showLoginBtn.addEventListener('click', () => {
  signupForm.style.display = 'none';
  loginForm.style.display = 'flex';
  signupError.textContent = '';
  loginUser.focus();
});

// Login — real API call
async function handleLogin(): Promise<void> {
  const user = loginUser.value.trim();
  const pass = loginPass.value;

  if (!user) {
    showAuthError(loginError, 'username required');
    loginUser.focus();
    return;
  }
  if (!pass) {
    showAuthError(loginError, 'password required');
    loginPass.focus();
    return;
  }
  if (user.length < 3) {
    showAuthError(loginError, 'username too short (min 3)');
    loginUser.focus();
    return;
  }

  loginBtn.classList.add('loading');
  loginBtn.textContent = 'connecting...';

  try {
    const data = await api.login(user, pass);
    loginBtn.classList.remove('loading');
    loginBtn.textContent = 'connect';
    dismissAuth(data.user);
  } catch (err: any) {
    loginBtn.classList.remove('loading');
    loginBtn.textContent = 'connect';
    showAuthError(loginError, err.message || 'login failed');
  }
}

loginBtn.addEventListener('click', handleLogin);
loginPass.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});
loginUser.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginPass.focus();
});

// Signup — real API call
async function handleSignup(): Promise<void> {
  const user = signupUser.value.trim();
  const email = signupEmail.value.trim();
  const pass = signupPass.value;
  const confirm = signupConfirm.value;

  if (!user) {
    showAuthError(signupError, 'username required');
    signupUser.focus();
    return;
  }
  if (user.length < 3) {
    showAuthError(signupError, 'username too short (min 3)');
    signupUser.focus();
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(user)) {
    showAuthError(signupError, 'username: letters, numbers, _ only');
    signupUser.focus();
    return;
  }
  if (!email || !email.includes('@')) {
    showAuthError(signupError, 'valid email required');
    signupEmail.focus();
    return;
  }
  if (!pass) {
    showAuthError(signupError, 'password required');
    signupPass.focus();
    return;
  }
  if (pass.length < 6) {
    showAuthError(signupError, 'password too short (min 6)');
    signupPass.focus();
    return;
  }
  if (pass !== confirm) {
    showAuthError(signupError, 'passwords do not match');
    signupConfirm.focus();
    return;
  }

  signupBtn.classList.add('loading');
  signupBtn.textContent = 'registering...';

  try {
    const data = await api.signup(user, email, pass);
    signupBtn.classList.remove('loading');
    signupBtn.textContent = 'register';
    dismissAuth(data.user);
  } catch (err: any) {
    signupBtn.classList.remove('loading');
    signupBtn.textContent = 'register';
    showAuthError(signupError, err.message || 'registration failed');
  }
}

signupBtn.addEventListener('click', handleSignup);
signupConfirm.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSignup();
});
signupUser.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') signupEmail.focus();
});
signupEmail.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') signupPass.focus();
});
signupPass.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') signupConfirm.focus();
});

// ── Auto-login: verify stored token on startup ──
(async () => {
  const token = api.getToken();
  if (token) {
    try {
      const user = await api.verifyToken();
      dismissAuth(user);
    } catch {
      // Token expired or invalid — show login
      api.clearToken();
    }
  }
})();

// ── Helpers ──
function getTimestamp(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function scrollToBottom(): void {
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ── Message rendering ──
type MessageType = 'user' | 'bot' | 'system';

function addMessage(
  username: string,
  text: string,
  type: MessageType = 'user',
  timestamp?: string
): void {
  const line = document.createElement('div');
  line.className = 'message-line';

  const ts = timestamp || getTimestamp();

  if (type === 'system') {
    line.innerHTML = `
      <span class="msg-system">*** ${text}</span>
      <span class="msg-timestamp">[${ts}]</span>
    `;
  } else {
    const usernameClass = type === 'bot' ? 'msg-username bot' : 'msg-username';
    const displayName = username.startsWith('@') ? username : `@${username}`;
    line.innerHTML = `
      <span class="${usernameClass}">&lt;${displayName}&gt;</span>
      <span class="msg-text">${escapeHtml(text)}</span>
      <span class="msg-timestamp">[${ts}]</span>
    `;
  }

  chatArea.appendChild(line);
  scrollToBottom();
}

function renderApiMessage(msg: Message): void {
  const ts = getTimestamp(msg.createdAt);
  addMessage(msg.senderUsername || 'unknown', msg.content || '', msg.type || 'user', ts);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Commands ──
function handleCommand(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return false;

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case '/help':
      addMessage('', 'system: Available commands:', 'system');
      addMessage('', 'system: /help - Show this help message', 'system');
      addMessage('', 'system: /clear - Clear chat history', 'system');
      addMessage('', 'system: /nick <name> - Change nickname', 'system');
      addMessage('', 'system: /users - List connected users', 'system');
      addMessage('', 'system: /me <action> - Send an action message', 'system');
      addMessage('', 'system: /join <channel> - Join a channel', 'system');
      addMessage('', 'system: /leave - Leave current channel', 'system');
      addMessage('', 'system: /search <query> - Search users by username', 'system');
      addMessage('', 'system: /members - List members of current channel', 'system');
      addMessage('', 'system: /invite [maxUses] [expiresHrs] - Create invite link (admin)', 'system');
      addMessage('', 'system: /invites - List active invites (admin)', 'system');
      addMessage('', 'system: /revoke <inviteId> - Revoke an invite (admin)', 'system');
      addMessage('', 'system: /add <username> - Add user to channel (admin)', 'system');
      addMessage('', 'system: /kick <username> - Remove user from channel (admin)', 'system');
      addMessage('', 'system: /joincode <code> - Join channel via invite code', 'system');
      return true;

    case '/clear':
      chatArea.innerHTML = '';
      addMessage('', 'system: Chat cleared.', 'system');
      return true;

    case '/nick':
      if (parts.length > 1) {
        const newNick = parts[1].replace(/^@/, '');
        api.updateMe({ username: newNick }).then((updated) => {
          currentUser = updated;
          addMessage('', `system: Nickname changed to @${updated.username}`, 'system');
          if (brandEl) {
            brandEl.innerHTML = `bitchat / <span class="username">@${updated.username}</span>`;
          }
        }).catch((err) => {
          addMessage('', `system: Failed to change nick: ${err.message}`, 'system');
        });
      } else {
        addMessage('', 'system: Usage: /nick <name>', 'system');
      }
      return true;

    case '/users':
      fetchAndShowUsers();
      return true;

    case '/me':
      if (parts.length > 1 && activeChannelId) {
        const action = parts.slice(1).join(' ');
        const username = currentUser?.username || 'anon';
        api.sendMessage(activeChannelId, `* @${username} ${action}`, 'system').catch(() => {
          addMessage('', `* @${username} ${action}`, 'system');
        });
      } else {
        addMessage('', 'system: Usage: /me <action>', 'system');
      }
      return true;

    case '/join':
      if (parts.length > 1) {
        const channelName = parts[1].replace(/^#/, '');
        handleJoinChannel(channelName);
      } else {
        addMessage('', 'system: Usage: /join <channel>', 'system');
      }
      return true;

    case '/leave':
      if (activeChannelId) {
        api.leaveChannel(activeChannelId).then(() => {
          addMessage('', `system: Left channel`, 'system');
          loadChannels();
        }).catch((err) => {
          addMessage('', `system: Failed to leave: ${err.message}`, 'system');
        });
      }
      return true;

    case '/search':
      if (parts.length > 1) {
        const query = parts.slice(1).join(' ');
        handleSearchUsers(query);
      } else {
        addMessage('', 'system: Usage: /search <query>', 'system');
      }
      return true;

    case '/members':
      if (activeChannelId) {
        handleListMembers();
      } else {
        addMessage('', 'system: No channel selected', 'system');
      }
      return true;

    case '/invite':
      if (activeChannelId) {
        const maxUses = parts[1] ? parseInt(parts[1], 10) : undefined;
        const expiresInHours = parts[2] ? parseInt(parts[2], 10) : undefined;
        handleCreateInvite(maxUses, expiresInHours);
      } else {
        addMessage('', 'system: No channel selected', 'system');
      }
      return true;

    case '/invites':
      if (activeChannelId) {
        handleListInvites();
      } else {
        addMessage('', 'system: No channel selected', 'system');
      }
      return true;

    case '/revoke':
      if (parts.length > 1 && activeChannelId) {
        handleRevokeInvite(parts[1]);
      } else {
        addMessage('', 'system: Usage: /revoke <inviteId>', 'system');
      }
      return true;

    case '/add':
      if (parts.length > 1 && activeChannelId) {
        const username = parts[1].replace(/^@/, '');
        handleAddMember(username);
      } else {
        addMessage('', 'system: Usage: /add <username>', 'system');
      }
      return true;

    case '/kick':
      if (parts.length > 1 && activeChannelId) {
        const username = parts[1].replace(/^@/, '');
        handleKickMember(username);
      } else {
        addMessage('', 'system: Usage: /kick <username>', 'system');
      }
      return true;

    case '/joincode':
      if (parts.length > 1) {
        handleJoinByInviteCode(parts[1]);
      } else {
        addMessage('', 'system: Usage: /joincode <invite-code>', 'system');
      }
      return true;

    default:
      addMessage('', `system: Unknown command: ${cmd}. Type /help for available commands.`, 'system');
      return true;
  }
}

async function fetchAndShowUsers(): Promise<void> {
  try {
    const users = await api.listUsers();
    const onlineUsers = users.filter((u) => u.status === 'online');
    const names = onlineUsers.map((u) => `@${u.username}`).join(', ');
    addMessage('', `system: Online users (${onlineUsers.length}): ${names}`, 'system');
  } catch (err: any) {
    addMessage('', `system: Failed to fetch users: ${err.message}`, 'system');
  }
}

async function handleJoinChannel(name: string): Promise<void> {
  try {
    // Try to find existing channel
    const existing = channels.find((c) => c.name === name || c.name === `#${name}`);
    if (existing) {
      await api.joinChannel(existing.id);
      addMessage('', `system: Joined #${name}`, 'system');
      switchToChannel(existing);
    } else {
      // Create and join
      const ch = await api.createChannel(name, 'channel');
      addMessage('', `system: Created and joined #${name}`, 'system');
      await loadChannels();
      switchToChannel(ch);
    }
  } catch (err: any) {
    addMessage('', `system: Failed to join #${name}: ${err.message}`, 'system');
  }
}

// ── Search users ──
async function handleSearchUsers(query: string): Promise<void> {
  try {
    const users = await api.searchUsers(query);
    if (users.length === 0) {
      addMessage('', `system: No users found matching "${query}"`, 'system');
    } else {
      addMessage('', `system: Search results for "${query}" (${users.length}):`, 'system');
      users.forEach((u) => {
        addMessage('', `system:   @${u.username} [${u.status}]`, 'system');
      });
    }
  } catch (err: any) {
    addMessage('', `system: Search failed: ${err.message}`, 'system');
  }
}

// ── List channel members ──
async function handleListMembers(): Promise<void> {
  if (!activeChannelId) return;
  try {
    const members = await api.getChannelMembers(activeChannelId);
    addMessage('', `system: Channel members (${members.length}):`, 'system');
    members.forEach((m) => {
      const roleTag = m.role === 'admin' ? ' [admin]' : '';
      addMessage('', `system:   @${m.username} [${m.status}]${roleTag}`, 'system');
    });
  } catch (err: any) {
    addMessage('', `system: Failed to list members: ${err.message}`, 'system');
  }
}

// ── Create invite ──
async function handleCreateInvite(maxUses?: number, expiresInHours?: number): Promise<void> {
  if (!activeChannelId) return;
  try {
    const opts: { maxUses?: number; expiresInHours?: number } = {};
    if (maxUses && !isNaN(maxUses)) opts.maxUses = maxUses;
    if (expiresInHours && !isNaN(expiresInHours)) opts.expiresInHours = expiresInHours;

    const invite = await api.createInvite(activeChannelId, opts);
    addMessage('', `system: Invite created!`, 'system');
    addMessage('', `system: Code: ${invite.code}`, 'system');
    addMessage('', `system: Join with: /joincode ${invite.code}`, 'system');
    if (invite.maxUses) addMessage('', `system: Max uses: ${invite.maxUses}`, 'system');
    if (invite.expiresAt) addMessage('', `system: Expires: ${new Date(invite.expiresAt).toLocaleString()}`, 'system');
  } catch (err: any) {
    addMessage('', `system: Failed to create invite: ${err.message}`, 'system');
  }
}

// ── List invites ──
async function handleListInvites(): Promise<void> {
  if (!activeChannelId) return;
  try {
    const invites = await api.listInvites(activeChannelId);
    const active = invites.filter((i) => i.isActive);
    if (active.length === 0) {
      addMessage('', 'system: No active invites for this channel', 'system');
    } else {
      addMessage('', `system: Active invites (${active.length}):`, 'system');
      active.forEach((inv) => {
        const uses = inv.maxUses ? `${inv.uses}/${inv.maxUses}` : `${inv.uses}/unlimited`;
        const expires = inv.expiresAt ? `expires ${new Date(inv.expiresAt).toLocaleString()}` : 'no expiry';
        addMessage('', `system:   [id:${inv.id}] ${inv.code} (${uses} uses, ${expires})`, 'system');
      });
    }
  } catch (err: any) {
    addMessage('', `system: Failed to list invites: ${err.message}`, 'system');
  }
}

// ── Revoke invite ──
async function handleRevokeInvite(inviteIdStr: string): Promise<void> {
  if (!activeChannelId) return;
  try {
    await api.revokeInvite(activeChannelId, inviteIdStr);
    addMessage('', `system: Invite ${inviteIdStr} revoked`, 'system');
  } catch (err: any) {
    addMessage('', `system: Failed to revoke invite: ${err.message}`, 'system');
  }
}

// ── Add member (admin) ──
async function handleAddMember(username: string): Promise<void> {
  if (!activeChannelId) return;
  try {
    // Search for the user first to get their ID
    const results = await api.searchUsers(username);
    const exact = results.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!exact) {
      addMessage('', `system: User @${username} not found`, 'system');
      return;
    }
    await api.addMember(activeChannelId, exact.id);
    addMessage('', `system: @${exact.username} added to the channel`, 'system');
    // Refresh members
    loadChannelMembers();
  } catch (err: any) {
    addMessage('', `system: Failed to add @${username}: ${err.message}`, 'system');
  }
}

// ── Kick member (admin) ──
async function handleKickMember(username: string): Promise<void> {
  if (!activeChannelId) return;
  try {
    // Find in current channel members
    const member = channelMembers.find(
      (m) => m.username.toLowerCase() === username.toLowerCase()
    );
    if (!member) {
      addMessage('', `system: @${username} is not a member of this channel`, 'system');
      return;
    }
    await api.removeMember(activeChannelId, member.id);
    addMessage('', `system: @${member.username} removed from the channel`, 'system');
    // Refresh members
    loadChannelMembers();
  } catch (err: any) {
    addMessage('', `system: Failed to kick @${username}: ${err.message}`, 'system');
  }
}

// ── Join by invite code ──
async function handleJoinByInviteCode(code: string): Promise<void> {
  try {
    const channel = await api.joinByInviteCode(code);
    addMessage('', `system: Joined #${channel.name} via invite`, 'system');
    await loadChannels();
    switchToChannel(channel);
  } catch (err: any) {
    addMessage('', `system: Failed to join via invite: ${err.message}`, 'system');
  }
}

// ── Load channel members ──
async function loadChannelMembers(): Promise<void> {
  if (!activeChannelId) return;
  try {
    channelMembers = await api.getChannelMembers(activeChannelId);
    const me = channelMembers.find((m) => currentUser && m.id === currentUser.id);
    myRoleInChannel = me?.role || null;
    renderPeopleList();
  } catch {
    channelMembers = [];
    myRoleInChannel = null;
  }
}

function getDisplayUsername(): string {
  return currentUser ? `@${currentUser.username}` : '@anon';
}

// ── Input handling ──
messageInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    const text = messageInput.value.trim();
    if (!text) return;

    messageInput.value = '';

    if (!handleCommand(text)) {
      // Send real message
      if (activeChannelId) {
        // Optimistic UI: show immediately
        addMessage(getDisplayUsername(), text, 'user');

        // Send via WebSocket if connected, else REST fallback
        if (isWsConnected()) {
          sendWs({
            type: 'message',
            channelId: activeChannelId,
            content: text,
          });
        } else {
          api.sendMessage(activeChannelId, text).catch((err) => {
            addMessage('', `system: Failed to send: ${err.message}`, 'system');
          });
        }
      } else {
        addMessage('', 'system: No channel selected. Use /join <channel> or pick one from sidebar.', 'system');
      }
    }
  }
});

// ── Theme toggle ──
themeToggle.addEventListener('click', () => {
  isDark = !isDark;
  if (isDark) {
    document.body.classList.remove('light');
    themeIcon.textContent = 'light_mode';
  } else {
    document.body.classList.add('light');
    themeIcon.textContent = 'dark_mode';
  }
});

// ── Sidebar toggle ──
hamburgerBtn.addEventListener('click', () => {
  sidebarOpen = !sidebarOpen;
  document.body.classList.toggle('sidebar-open', sidebarOpen);
});

// ── People toggle ──
peopleToggle.addEventListener('click', () => {
  peopleOpen = !peopleOpen;
  document.body.classList.toggle('people-open', peopleOpen);
  if (peopleOpen) {
    // Refresh people list and channel members when opening
    loadUsers();
    loadChannelMembers();
  }
});

// ══════════════════════════════════════
// Real data: People list
// ══════════════════════════════════════

async function loadUsers(): Promise<void> {
  try {
    allUsers = await api.listUsers();
    renderPeopleList();
  } catch (err: any) {
    addMessage('', `system: Failed to load users: ${err.message}`, 'system');
  }
}

function renderPeopleList(): void {
  interface PersonEntry {
    id: number;
    name: string;
    status: 'online' | 'idle' | 'offline';
    role?: string;
    isSelf?: boolean;
    isBot?: boolean;
    isAdmin?: boolean;
  }

  // If we have channel members, use those for role info; otherwise fall back to allUsers
  const sourceUsers = channelMembers.length > 0 ? channelMembers : allUsers;

  const people: PersonEntry[] = sourceUsers.map((u) => {
    const memberInfo = channelMembers.find((m) => m.id === u.id);
    const isSelf = currentUser ? u.id === currentUser.id : false;
    let role: string | undefined;
    if (isSelf) role = 'you';
    if (memberInfo?.role === 'admin') role = isSelf ? 'you / admin' : 'admin';

    return {
      id: u.id,
      name: `@${u.username}`,
      status: (u.status as 'online' | 'idle' | 'offline') || 'offline',
      isSelf,
      role,
      isAdmin: memberInfo?.role === 'admin',
    };
  });

  // Sort: self first, then admins, then online, idle, offline
  const order = { online: 0, idle: 1, offline: 2 };
  people.sort((a, b) => {
    if (a.isSelf) return -1;
    if (b.isSelf) return 1;
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return order[a.status] - order[b.status];
  });

  const onlineCount = people.filter((p) => p.status === 'online').length;

  peopleList.innerHTML = '';

  // Search bar
  const searchWrap = document.createElement('div');
  searchWrap.className = 'people-search-wrap';
  searchWrap.innerHTML = `
    <span class="people-search-icon material-icons">search</span>
    <input type="text" class="people-search-input" placeholder="search users..." id="peopleSearchInput" />
  `;
  peopleList.appendChild(searchWrap);

  // Render people items
  people.forEach((person) => {
    const item = document.createElement('div');
    item.className = 'person-item';
    item.setAttribute('data-user-id', String(person.id));

    let nameClass = 'person-name';
    if (person.isBot) nameClass += ' is-bot';
    if (person.isSelf) nameClass += ' is-self';

    const adminBadge = person.isAdmin ? '<span class="person-admin-badge">admin</span>' : '';

    item.innerHTML = `
      <div class="person-status ${person.status}"></div>
      <span class="${nameClass}">${person.name}</span>
      ${adminBadge}
      ${person.role ? `<span class="person-role">${person.role}</span>` : ''}
    `;

    // Right-click context: admin can kick non-self, non-admin members
    if (myRoleInChannel === 'admin' && !person.isSelf && !person.isAdmin) {
      item.style.cursor = 'pointer';
      item.title = 'Click to kick';
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const username = person.name.replace(/^@/, '');
        if (confirm(`Kick @${username} from the channel?`)) {
          handleKickMember(username);
        }
      });
    }

    peopleList.appendChild(item);
  });

  // Wire up search after render
  const searchInput = document.getElementById('peopleSearchInput') as HTMLInputElement;
  if (searchInput) {
    let searchTimeout: ReturnType<typeof setTimeout> | null = null;
    searchInput.addEventListener('input', () => {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const q = searchInput.value.trim();
        if (q.length < 2) {
          // Restore normal list
          renderPeopleSearchResults(null);
          return;
        }
        try {
          const results = await api.searchUsers(q);
          renderPeopleSearchResults(results);
        } catch {
          // Silently fail
        }
      }, 300);
    });
  }

  peopleCountEl.textContent = `${onlineCount} online`;
  userCountEl.textContent = String(onlineCount);
}

function renderPeopleSearchResults(results: User[] | null): void {
  // Remove old search results
  const existing = document.querySelectorAll('.person-item.search-result');
  existing.forEach((el) => el.remove());

  // Show/hide regular items
  const regularItems = peopleList.querySelectorAll('.person-item:not(.search-result)');

  if (results === null) {
    // Show all regular items
    regularItems.forEach((el) => (el as HTMLElement).style.display = '');
    return;
  }

  // Hide regular items
  regularItems.forEach((el) => (el as HTMLElement).style.display = 'none');

  // Show search results
  if (results.length === 0) {
    const noResult = document.createElement('div');
    noResult.className = 'person-item search-result';
    noResult.innerHTML = '<span class="msg-system" style="font-size:11px">no matches</span>';
    peopleList.appendChild(noResult);
    return;
  }

  results.forEach((u) => {
    const item = document.createElement('div');
    item.className = 'person-item search-result';

    const isSelf = currentUser ? u.id === currentUser.id : false;
    let nameClass = 'person-name';
    if (isSelf) nameClass += ' is-self';

    item.innerHTML = `
      <div class="person-status ${u.status || 'offline'}"></div>
      <span class="${nameClass}">@${u.username}</span>
      <span class="person-role">${u.status || 'offline'}</span>
    `;

    // Click to add to channel (if admin)
    if (myRoleInChannel === 'admin' && activeChannelId && !isSelf) {
      item.style.cursor = 'pointer';
      item.title = 'Click to add to channel';
      item.addEventListener('click', () => {
        api.addMember(activeChannelId!, u.id).then(() => {
          addMessage('', `system: @${u.username} added to the channel`, 'system');
          loadChannelMembers();
        }).catch((err: any) => {
          addMessage('', `system: Failed to add @${u.username}: ${err.message}`, 'system');
        });
      });
    }

    peopleList.appendChild(item);
  });
}

// ══════════════════════════════════════
// Real data: Channel / chat list
// ══════════════════════════════════════

async function loadChannels(): Promise<void> {
  try {
    channels = await api.listChannels();
    renderChatList();
  } catch (err: any) {
    addMessage('', `system: Failed to load channels: ${err.message}`, 'system');
  }
}

let channelSearchFilter = '';

function renderChatList(): void {
  chatList.innerHTML = '';

  // Search bar
  const searchWrap = document.createElement('div');
  searchWrap.className = 'sidebar-search-wrap';
  searchWrap.innerHTML = `
    <span class="sidebar-search-icon material-icons">search</span>
    <input type="text" class="sidebar-search-input" placeholder="search chats..." id="sidebarSearchInput" />
  `;
  chatList.appendChild(searchWrap);

  // Filter channels
  const filtered = channelSearchFilter
    ? channels.filter((ch) => ch.name.toLowerCase().includes(channelSearchFilter.toLowerCase()))
    : channels;

  if (filtered.length === 0 && channelSearchFilter) {
    const noResult = document.createElement('div');
    noResult.className = 'sidebar-no-results';
    noResult.textContent = 'no matches';
    chatList.appendChild(noResult);
  }

  filtered.forEach((ch) => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (ch.id === activeChannelId ? ' active' : '');

    const displayName = ch.type === 'dm' ? `@${ch.name}` : `#${ch.name}`;
    const initials = ch.name.slice(0, 2).toUpperCase();
    const lastMsg = ch.lastMessage;
    const preview = lastMsg ? lastMsg.content : '';
    const time = lastMsg?.createdAt ? formatTime(lastMsg.createdAt) : '';
    const unread = ch.unreadCount || 0;

    item.innerHTML = `
      <div class="chat-item-avatar">${initials}</div>
      <div class="chat-item-info">
        <div class="chat-item-name">${displayName}</div>
        <div class="chat-item-preview">${escapeHtml(preview)}</div>
      </div>
      <div class="chat-item-meta">
        <span class="chat-item-time">${time}</span>
        ${unread > 0 ? `<div class="chat-item-badge">${unread}</div>` : ''}
      </div>
    `;

    item.addEventListener('click', () => {
      switchToChannel(ch);
    });

    chatList.appendChild(item);
  });

  // Wire up sidebar search
  const sidebarInput = document.getElementById('sidebarSearchInput') as HTMLInputElement;
  if (sidebarInput) {
    // Preserve current filter value
    sidebarInput.value = channelSearchFilter;
    sidebarInput.addEventListener('input', () => {
      channelSearchFilter = sidebarInput.value.trim();
      renderChatList();
      // Re-focus after re-render
      const newInput = document.getElementById('sidebarSearchInput') as HTMLInputElement;
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    });
  }
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  // Yesterday or older
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'yday';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

async function switchToChannel(ch: Channel): Promise<void> {
  activeChannelId = ch.id;

  // Update sidebar active state
  document.querySelectorAll('.chat-item').forEach((el) => el.classList.remove('active'));
  renderChatList(); // re-render to update active class

  // Update header channel
  const channelEl = document.querySelector('.channel') as HTMLElement;
  if (channelEl) {
    channelEl.textContent = ch.type === 'dm' ? `@${ch.name}` : `#${ch.name}`;
  }

  // Mark as read
  api.markChannelRead(ch.id).catch(() => {});

  // Subscribe to this channel via WebSocket
  if (isWsConnected()) {
    sendWs({ type: 'join-channel', channelId: ch.id });
  }

  // Hide empty state, show chat UI
  showChatUI();

  // Load channel members (for role info)
  loadChannelMembers();

  // Clear chat and load history
  chatArea.innerHTML = '';
  addMessage('', `system: switched to ${ch.type === 'dm' ? '@' : '#'}${ch.name}`, 'system');

  try {
    const messages = await api.getMessages(ch.id, { limit: 50 });
    // Messages come newest-first from API typically, reverse for chronological
    const chronological = [...messages].reverse();
    chronological.forEach((msg) => renderApiMessage(msg));
  } catch (err: any) {
    addMessage('', `system: Failed to load messages: ${err.message}`, 'system');
  }
}

// ══════════════════════════════════════
// WebSocket event handlers
// ══════════════════════════════════════

function setupWsHandlers(): void {
  // New message from WS — server sends: { type, id, channelId, senderId, senderUsername, content, messageType, timestamp }
  onWs('message', (msg) => {
    const data = msg.data;
    const channelId = data.channelId;
    const senderId = data.senderId;
    const senderUsername = data.senderUsername || 'unknown';
    const content = data.content || '';
    const ts = data.timestamp || data.createdAt;

    // Only render if it's for the active channel and not our own message
    if (channelId === activeChannelId) {
      if (!currentUser || senderId !== currentUser.id) {
        const timeStr = ts ? getTimestamp(ts) : undefined;
        addMessage(senderUsername, content, data.messageType || 'user', timeStr);
      }
    }

    // Update sidebar unread count for non-active channels
    if (channelId !== activeChannelId) {
      const ch = channels.find((c) => c.id === channelId);
      if (ch) {
        ch.unreadCount = (ch.unreadCount || 0) + 1;
        ch.lastMessage = { content, senderId, senderUsername, createdAt: ts || new Date().toISOString() };
        renderChatList();
      }
    }
  });

  // Local synthetic event: WS connected
  onWs('presence', (msg) => {
    const data = msg.data;
    if (data.status === 'connected') {
      addMessage('', 'system: connected to mesh', 'system');
      // Set ourselves online
      api.updateMe({ status: 'online' }).catch(() => {});
    }
  });

  // Server sends type: 'connected' on auth success
  onWs('connected', () => {
    // Join all channels we're a member of
    channels.forEach((ch) => {
      sendWs({ type: 'join-channel', channelId: ch.id });
    });
  });

  // Status change for a user
  onWs('status-changed', (msg) => {
    const data = msg.data;
    if (data.userId) {
      const user = allUsers.find((u) => u.id === data.userId);
      if (user) {
        user.status = data.status;
        renderPeopleList();
      }
    }
  });

  // User joined a channel
  onWs('user-joined', (msg) => {
    const data = msg.data;
    if (data.channelId === activeChannelId) {
      const username = data.user?.username || data.username || 'unknown';
      addMessage('', `system: @${username} joined`, 'system');
    }
  });

  // User left a channel
  onWs('user-left', (msg) => {
    const data = msg.data;
    if (data.channelId === activeChannelId) {
      addMessage('', `system: user left`, 'system');
    }
  });

  // Channel updates (new channel, name change, etc.)
  onWs('channel_update', () => {
    loadChannels();
  });
}

// ══════════════════════════════════════
// Empty state / Chat UI toggle
// ══════════════════════════════════════

const chatPanel = document.getElementById('chatPanel') as HTMLElement;
let emptyStateEl: HTMLElement | null = null;

function showEmptyState(): void {
  // Hide chat area, keep footer visible for /join commands
  chatArea.style.display = 'none';
  (document.querySelector('.theme-toggle-container') as HTMLElement).style.display = 'none';

  // Update header to show no channel
  const channelEl = document.querySelector('.channel') as HTMLElement;
  if (channelEl) channelEl.textContent = '';

  // Show empty state
  if (!emptyStateEl) {
    emptyStateEl = document.createElement('div');
    emptyStateEl.className = 'empty-state';
    emptyStateEl.innerHTML = `
      <div class="empty-state-icon material-icons">forum</div>
      <div class="empty-state-title">bitchat</div>
      <div class="empty-state-hint">select a channel from the sidebar<br/>or type <span class="empty-state-cmd">/join &lt;channel&gt;</span> to get started</div>
    `;
    // Insert before footer so footer stays at bottom
    const footer = document.getElementById('footer') as HTMLElement;
    chatPanel.insertBefore(emptyStateEl, footer);
  }
  emptyStateEl.style.display = 'flex';
}

function showChatUI(): void {
  // Show chat area
  chatArea.style.display = '';
  (document.querySelector('.theme-toggle-container') as HTMLElement).style.display = '';

  // Hide empty state
  if (emptyStateEl) {
    emptyStateEl.style.display = 'none';
  }
}

// ══════════════════════════════════════
// App initialization (after auth)
// ══════════════════════════════════════

async function initApp(): Promise<void> {
  // Show empty state on startup (no channel selected)
  showEmptyState();

  // Setup WebSocket handlers before connecting
  setupWsHandlers();

  // Connect WebSocket
  connectWs();

  // Load channels and users in parallel
  await Promise.all([loadChannels(), loadUsers()]);

  // Periodically refresh users for presence updates (every 30s)
  setInterval(() => {
    loadUsers();
  }, 30000);
}

// ── Set idle on window blur, online on focus ──
window.addEventListener('blur', () => {
  if (currentUser) {
    api.updateMe({ status: 'idle' }).catch(() => {});
  }
});
window.addEventListener('focus', () => {
  if (currentUser) {
    api.updateMe({ status: 'online' }).catch(() => {});
  }
});

// ── Cleanup on unload ──
window.addEventListener('beforeunload', () => {
  if (currentUser) {
    api.updateMe({ status: 'offline' }).catch(() => {});
  }
  disconnectWs();
});
