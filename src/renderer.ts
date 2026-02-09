import './index.css';

declare global {
  interface Window {
    electronAPI: {
      setMovable: (movable: boolean) => void;
      toggleSidebar: () => Promise<boolean>;
      togglePeople: () => Promise<boolean>;
    };
  }
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
let currentUser = '@anon' + Math.floor(1000 + Math.random() * 9000);
let isDark = true;
let sidebarOpen = false;
let peopleOpen = false;

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

function dismissAuth(username: string): void {
  currentUser = '@' + username.replace(/^@/, '');
  (window as any).__currentUser = currentUser;

  if (brandEl) {
    brandEl.innerHTML = `bitchat / <span class="username">${currentUser}</span>`;
  }

  // Fade out overlay, reveal app
  authOverlay.style.transition = 'opacity 0.3s ease';
  authOverlay.style.opacity = '0';
  setTimeout(() => {
    authOverlay.classList.add('hidden');
    appContainer.style.display = 'flex';
    messageInput.focus();
    initChat();
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

// Login
function handleLogin(): void {
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

  // Simulate auth delay
  loginBtn.classList.add('loading');
  loginBtn.textContent = 'connecting...';
  setTimeout(() => {
    loginBtn.classList.remove('loading');
    loginBtn.textContent = 'connect';
    dismissAuth(user);
  }, 800);
}

loginBtn.addEventListener('click', handleLogin);
loginPass.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});
loginUser.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginPass.focus();
});

// Signup
function handleSignup(): void {
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

  // Simulate registration delay
  signupBtn.classList.add('loading');
  signupBtn.textContent = 'registering...';
  setTimeout(() => {
    signupBtn.classList.remove('loading');
    signupBtn.textContent = 'register';
    dismissAuth(user);
  }, 1000);
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

// ── Helpers ──
function getTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
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
  type: MessageType = 'user'
): void {
  const line = document.createElement('div');
  line.className = 'message-line';

  const timestamp = getTimestamp();

  if (type === 'system') {
    line.innerHTML = `
      <span class="msg-system">*** ${text}</span>
      <span class="msg-timestamp">[${timestamp}]</span>
    `;
  } else {
    const usernameClass = type === 'bot' ? 'msg-username bot' : 'msg-username';
    line.innerHTML = `
      <span class="${usernameClass}">&lt;${username}&gt;</span>
      <span class="msg-text">${escapeHtml(text)}</span>
      <span class="msg-timestamp">[${timestamp}]</span>
    `;
  }

  chatArea.appendChild(line);
  scrollToBottom();
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
      return true;

    case '/clear':
      chatArea.innerHTML = '';
      addMessage('', 'system: Chat cleared.', 'system');
      return true;

    case '/nick':
      if (parts.length > 1) {
        const newNick = '@' + parts[1].replace(/^@/, '');
        addMessage('', `system: Nickname changed to ${newNick}`, 'system');
        Object.defineProperty(window, '__currentUser', { value: newNick, writable: true });
        (window as any).__currentUser = newNick;
        if (brandEl) {
          brandEl.innerHTML = `bitchat / <span class="username">${newNick}</span>`;
        }
      } else {
        addMessage('', 'system: Usage: /nick <name>', 'system');
      }
      return true;

    case '/users':
      addMessage('', `system: Connected users: ${getCurrentUser()}, @mod_bot`, 'system');
      return true;

    case '/me':
      if (parts.length > 1) {
        const action = parts.slice(1).join(' ');
        addMessage('', `* ${getCurrentUser()} ${action}`, 'system');
      } else {
        addMessage('', 'system: Usage: /me <action>', 'system');
      }
      return true;

    default:
      addMessage('', `system: Unknown command: ${cmd}. Type /help for available commands.`, 'system');
      return true;
  }
}

function getCurrentUser(): string {
  return (window as any).__currentUser || currentUser;
}

// ── Input handling ──
messageInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    const text = messageInput.value.trim();
    if (!text) return;

    messageInput.value = '';

    if (!handleCommand(text)) {
      addMessage(getCurrentUser(), text, 'user');

      // Simulate bot responses for demo
      simulateBotResponse(text);
    }
  }
});

// ── Bot simulation for demo ──
function simulateBotResponse(userText: string): void {
  const lower = userText.toLowerCase();

  if (lower === 'hi' || lower === 'hello' || lower === 'hey') {
    setTimeout(() => {
      addMessage('@mod_bot', `Hey there, ${getCurrentUser()}! Welcome to the mesh.`, 'bot');
    }, 800);
  } else if (lower.includes('help')) {
    setTimeout(() => {
      addMessage('@mod_bot', 'Type /help for a list of available commands.', 'bot');
    }, 600);
  } else if (lower === 'ping') {
    setTimeout(() => {
      addMessage('@mod_bot', 'pong!', 'bot');
    }, 300);
  }
}

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
hamburgerBtn.addEventListener('click', async () => {
  const isOpen = await window.electronAPI.toggleSidebar();
  sidebarOpen = isOpen;
  if (isOpen) {
    document.body.classList.add('sidebar-open');
  } else {
    document.body.classList.remove('sidebar-open');
  }
});

// ── People toggle ──
peopleToggle.addEventListener('click', async () => {
  const isOpen = await window.electronAPI.togglePeople();
  peopleOpen = isOpen;
  if (isOpen) {
    document.body.classList.add('people-open');
  } else {
    document.body.classList.remove('people-open');
  }
});

// ── Demo people list ──
interface PersonEntry {
  name: string;
  status: 'online' | 'idle' | 'offline';
  role?: string;
  isBot?: boolean;
  isSelf?: boolean;
}

const demoPeople: PersonEntry[] = [
  { name: '@mod_bot', status: 'online', role: 'bot', isBot: true },
  { name: '@satoshi', status: 'online' },
  { name: '@node_runner', status: 'online' },
  { name: '@cryptokid', status: 'idle' },
  { name: '@meshwalker', status: 'online' },
  { name: '@darknode', status: 'idle' },
  { name: '@p2p_larry', status: 'offline' },
  { name: '@ghostuser', status: 'offline' },
];

function renderPeopleList(): void {
  // Add self to the list
  const allPeople: PersonEntry[] = [
    { name: getCurrentUser(), status: 'online', role: 'you', isSelf: true },
    ...demoPeople,
  ];

  // Sort: online first, then idle, then offline
  const order = { online: 0, idle: 1, offline: 2 };
  allPeople.sort((a, b) => {
    if (a.isSelf) return -1;
    if (b.isSelf) return 1;
    return order[a.status] - order[b.status];
  });

  const onlineCount = allPeople.filter((p) => p.status === 'online').length;

  peopleList.innerHTML = '';
  allPeople.forEach((person) => {
    const item = document.createElement('div');
    item.className = 'person-item';

    let nameClass = 'person-name';
    if (person.isBot) nameClass += ' is-bot';
    if (person.isSelf) nameClass += ' is-self';

    item.innerHTML = `
      <div class="person-status ${person.status}"></div>
      <span class="${nameClass}">${person.name}</span>
      ${person.role ? `<span class="person-role">${person.role}</span>` : ''}
    `;

    peopleList.appendChild(item);
  });

  // Update counts
  peopleCountEl.textContent = `${onlineCount} online`;
  userCountEl.textContent = String(onlineCount);
}

// ── Demo chat list ──
interface ChatEntry {
  name: string;
  channel: string;
  preview: string;
  time: string;
  unread: number;
  active?: boolean;
}

const demoChats: ChatEntry[] = [
  { name: '#mesh', channel: 'mesh', preview: 'Welcome to the terminal...', time: '11:57', unread: 0, active: true },
  { name: '#general', channel: 'general', preview: 'anyone online?', time: '11:42', unread: 3 },
  { name: '#dev', channel: 'dev', preview: 'pushed new commit to main', time: '11:30', unread: 1 },
  { name: '@satoshi', channel: 'dm-satoshi', preview: 'check the new protocol', time: '10:15', unread: 0 },
  { name: '#random', channel: 'random', preview: 'lol nice one', time: '09:48', unread: 0 },
  { name: '@node_runner', channel: 'dm-node', preview: 'sync complete', time: '09:20', unread: 2 },
  { name: '#p2p', channel: 'p2p', preview: 'NAT traversal working', time: 'yday', unread: 0 },
];

function renderChatList(): void {
  chatList.innerHTML = '';
  demoChats.forEach((chat) => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (chat.active ? ' active' : '');

    const initials = chat.name.startsWith('#')
      ? chat.name.slice(1, 3).toUpperCase()
      : chat.name.slice(1, 3).toUpperCase();

    item.innerHTML = `
      <div class="chat-item-avatar">${initials}</div>
      <div class="chat-item-info">
        <div class="chat-item-name">${chat.name}</div>
        <div class="chat-item-preview">${chat.preview}</div>
      </div>
      <div class="chat-item-meta">
        <span class="chat-item-time">${chat.time}</span>
        ${chat.unread > 0 ? `<div class="chat-item-badge">${chat.unread}</div>` : ''}
      </div>
    `;

    item.addEventListener('click', () => {
      // Mark as active
      document.querySelectorAll('.chat-item').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');

      // Update header channel
      const channelEl = document.querySelector('.channel') as HTMLElement;
      if (channelEl) {
        channelEl.textContent = chat.name.startsWith('#') ? chat.name : chat.name;
      }

      // Clear unread
      chat.unread = 0;
      const badge = item.querySelector('.chat-item-badge');
      if (badge) badge.remove();

      // System message
      addMessage('', `system: switched to ${chat.name}`, 'system');
    });

    chatList.appendChild(item);
  });
}

// ── Initial messages (simulate startup after auth) ──
function initChat(): void {
  renderChatList();
  renderPeopleList();

  addMessage(getCurrentUser(), 'hi', 'user');

  setTimeout(() => {
    addMessage(getCurrentUser(), 'is anyone there?', 'user');
  }, 500);

  setTimeout(() => {
    addMessage('', 'system: connecting to mesh...', 'system');
  }, 1000);

  setTimeout(() => {
    addMessage('@mod_bot', 'Welcome to the terminal. Type /help for commands.', 'bot');
  }, 1500);
}
