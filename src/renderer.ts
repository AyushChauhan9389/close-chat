import './index.css';

declare global {
  interface Window {
    electronAPI: {
      setMovable: (movable: boolean) => void;
      toggleSidebar: () => Promise<boolean>;
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

// ── DOM refs ──
const chatArea = document.getElementById('chatArea') as HTMLElement;
const messageInput = document.getElementById('messageInput') as HTMLInputElement;
const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement;
const themeIcon = document.getElementById('themeIcon') as HTMLSpanElement;
const hamburgerBtn = document.getElementById('hamburgerBtn') as HTMLButtonElement;
const chatList = document.getElementById('chatList') as HTMLElement;

// ── State ──
const currentUser = '@anon' + Math.floor(1000 + Math.random() * 9000);
let isDark = true;
let sidebarOpen = false;

// Update header with generated username
const brandEl = document.querySelector('.brand') as HTMLElement;
if (brandEl) {
  brandEl.innerHTML = `bitchat / <span class="username">${currentUser}</span>`;
}

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

// ── Initial messages (simulate startup) ──
function init(): void {
  (window as any).__currentUser = currentUser;
  renderChatList();

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

init();
