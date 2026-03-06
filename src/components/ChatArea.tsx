import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../lib/api';
import EmojiPicker from './EmojiPicker';

// ── Command definitions for autocomplete ──
const COMMANDS = [
  { name: '/help', desc: 'Show available commands' },
  { name: '/clear', desc: 'Clear chat history' },
  { name: '/nick', desc: 'Change nickname', usage: '<name>' },
  { name: '/users', desc: 'List connected users' },
  { name: '/me', desc: 'Send an action message', usage: '<action>' },
  { name: '/join', desc: 'Join or create a channel', usage: '<channel>' },
  { name: '/leave', desc: 'Leave current channel' },
  { name: '/search', desc: 'Search users', usage: '<query>' },
  { name: '/members', desc: 'List channel members' },
  { name: '/invite', desc: 'Create invite link (admin)', usage: '[maxUses] [expiresHrs]' },
  { name: '/invites', desc: 'List active invites (admin)' },
  { name: '/revoke', desc: 'Revoke an invite (admin)', usage: '<inviteId>' },
  { name: '/add', desc: 'Add user to channel (admin)', usage: '<username>' },
  { name: '/kick', desc: 'Remove user from channel (admin)', usage: '<username>' },
  { name: '/joincode', desc: 'Join via invite code', usage: '<code>' },
  { name: '/dm', desc: 'Direct message a user', usage: '<username>' },
];

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDateLabel(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const yesterdayStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function ChatArea() {
  const {
    currentUser,
    setCurrentUser,
    activeChannelId,
    messages,
    addMessage,
    clearMessages,
    sendChatMessage,
    channels,
    loadChannels,
    loadChannelMembers,
    channelMembers,
    addMemberByUsername,
    removeMemberFromActiveChannel,
    switchToChannel,
    usernameStyle,
    hasMore,
    isLoadingMore,
    loadMoreMessages,
  } = useApp();

  const [inputValue, setInputValue] = useState('');
  const [cmdFiltered, setCmdFiltered] = useState<typeof COMMANDS>([]);
  const [cmdSelectedIndex, setCmdSelectedIndex] = useState(0);
  const [cmdVisible, setCmdVisible] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const chatAreaRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tracks whether the last messages change was a prepend (load more)
  const isPrependRef = useRef(false);
  // Captures scroll position before prepend so we can restore it after
  const scrollAnchorRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);

  // Restore scroll position after prepend — runs before browser paint
  useLayoutEffect(() => {
    const el = chatAreaRef.current;
    if (!el || !scrollAnchorRef.current) return;
    const { scrollTop: prevTop, scrollHeight: prevHeight } = scrollAnchorRef.current;
    el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
    scrollAnchorRef.current = null;
  }, [messages]);

  // Auto-scroll to bottom on new messages (not on prepend)
  useEffect(() => {
    const el = chatAreaRef.current;
    if (!el) return;
    if (isPrependRef.current) {
      isPrependRef.current = false;
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Scroll listener — load more when near top
  useEffect(() => {
    const el = chatAreaRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (el.scrollTop < 100 && hasMore && !isLoadingMore) {
        scrollAnchorRef.current = { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };
        isPrependRef.current = true;
        loadMoreMessages();
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, loadMoreMessages]);

  // Focus input when channel changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeChannelId]);

  // ── Command handler ──
  const handleCommand = useCallback((input: string): boolean => {
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
        addMessage('', 'system: /joincode <invite-code> - Join channel via invite code', 'system');
        addMessage('', 'system: /dm <username> - Direct message a user', 'system');
        return true;

      case '/clear':
        clearMessages();
        addMessage('', 'system: Chat cleared.', 'system');
        return true;

      case '/nick':
        if (parts.length > 1) {
          const newNick = parts[1].replace(/^@/, '');
          api.updateMe({ username: newNick }).then((updated) => {
            setCurrentUser(updated);
            addMessage('', `system: Nickname changed to @${updated.username}`, 'system');
          }).catch((err: Error) => {
            addMessage('', `system: Failed to change nick: ${err.message}`, 'system');
          });
        } else {
          addMessage('', 'system: Usage: /nick <name>', 'system');
        }
        return true;

      case '/users': {
        api.listUsers().then((users) => {
          const onlineUsers = users.filter((u) => u.status === 'online');
          const names = onlineUsers.map((u) => `@${u.username}`).join(', ');
          addMessage('', `system: Online users (${onlineUsers.length}): ${names}`, 'system');
        }).catch((err: Error) => {
          addMessage('', `system: Failed to fetch users: ${err.message}`, 'system');
        });
        return true;
      }

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
            addMessage('', 'system: Left channel', 'system');
            loadChannels();
          }).catch((err: Error) => {
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
          addMemberByUsername(username);
        } else {
          addMessage('', 'system: Usage: /add <username>', 'system');
        }
        return true;

      case '/kick':
        if (parts.length > 1 && activeChannelId) {
          const username = parts[1].replace(/^@/, '');
          removeMemberFromActiveChannel(username);
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

      case '/dm':
        if (parts.length > 1) {
          const username = parts[1].replace(/^@/, '');
          handleDm(username);
        } else {
          addMessage('', 'system: Usage: /dm <username>', 'system');
        }
        return true;

      default:
        addMessage('', `system: Unknown command: ${cmd}. Type /help for available commands.`, 'system');
        return true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId, currentUser, addMemberByUsername, addMessage, clearMessages, loadChannels, removeMemberFromActiveChannel, setCurrentUser, switchToChannel, channelMembers, channels, loadChannelMembers]);

  // ── Command helper functions ──
  async function handleJoinChannel(name: string) {
    try {
      const existing = channels.find((c) => c.name === name || c.name === `#${name}`);
      if (existing) {
        await api.joinChannel(existing.id);
        addMessage('', `system: Joined #${name}`, 'system');
        switchToChannel(existing);
      } else {
        const ch = await api.createChannel(name, 'channel');
        addMessage('', `system: Created and joined #${name}`, 'system');
        await loadChannels();
        switchToChannel(ch);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to join #${name}: ${message}`, 'system');
    }
  }

  async function handleSearchUsers(query: string) {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Search failed: ${message}`, 'system');
    }
  }

  async function handleListMembers() {
    if (!activeChannelId) return;
    try {
      const members = await api.getChannelMembers(activeChannelId);
      addMessage('', `system: Channel members (${members.length}):`, 'system');
      members.forEach((m) => {
        const roleTag = m.role === 'admin' ? ' [admin]' : '';
        addMessage('', `system:   @${m.username} [${m.status}]${roleTag}`, 'system');
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to list members: ${message}`, 'system');
    }
  }

  async function handleCreateInvite(maxUses?: number, expiresInHours?: number) {
    if (!activeChannelId) return;
    try {
      const opts: { maxUses?: number; expiresInHours?: number } = {};
      if (maxUses && !isNaN(maxUses)) opts.maxUses = maxUses;
      if (expiresInHours && !isNaN(expiresInHours)) opts.expiresInHours = expiresInHours;

      const invite = await api.createInvite(activeChannelId, opts);
      addMessage('', 'system: Invite created!', 'system');
      addMessage('', `system: Code: ${invite.code}`, 'system');
      addMessage('', `system: Join with: /joincode ${invite.code}`, 'system');
      if (invite.maxUses) addMessage('', `system: Max uses: ${invite.maxUses}`, 'system');
      if (invite.expiresAt) addMessage('', `system: Expires: ${new Date(invite.expiresAt).toLocaleString()}`, 'system');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to create invite: ${message}`, 'system');
    }
  }

  async function handleListInvites() {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to list invites: ${message}`, 'system');
    }
  }

  async function handleRevokeInvite(inviteIdStr: string) {
    if (!activeChannelId) return;
    try {
      await api.revokeInvite(activeChannelId, inviteIdStr);
      addMessage('', `system: Invite ${inviteIdStr} revoked`, 'system');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to revoke invite: ${message}`, 'system');
    }
  }

  async function handleJoinByInviteCode(code: string) {
    try {
      const channel = await api.joinByInviteCode(code);
      addMessage('', `system: Joined #${channel.name} via invite`, 'system');
      await loadChannels();
      switchToChannel(channel);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to join via invite: ${message}`, 'system');
    }
  }

  async function handleDm(username: string) {
    try {
      const results = await api.searchUsers(username);
      const exact = results.find((u) => u.username.toLowerCase() === username.toLowerCase());
      if (!exact) {
        addMessage('', `system: User @${username} not found`, 'system');
        return;
      }

      const { channel, created } = await api.getOrCreateDm(exact.id);
      if (created) {
        addMessage('', `system: Started DM with @${exact.username}`, 'system');
      } else {
        addMessage('', `system: Opened DM with @${exact.username}`, 'system');
      }

      channel.recipient = { id: exact.id, username: exact.username, status: exact.status };
      await loadChannels();
      switchToChannel(channel);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      addMessage('', `system: Failed to DM @${username}: ${message}`, 'system');
    }
  }

  // ── Input handling ──
  function handleInputChange(val: string) {
    setInputValue(val);
    if (val.startsWith('/') && !val.includes(' ')) {
      const prefix = val.toLowerCase();
      const filtered = COMMANDS.filter((c) => c.name.startsWith(prefix));
      if (filtered.length > 0) {
        setCmdFiltered(filtered);
        setCmdSelectedIndex(0);
        setCmdVisible(true);
      } else {
        setCmdVisible(false);
      }
    } else {
      setCmdVisible(false);
    }
  }

  function insertEmoji(emoji: string) {
    const input = inputRef.current;
    if (!input) {
      setInputValue((prev) => prev + emoji);
      return;
    }
    const start = input.selectionStart ?? inputValue.length;
    const end = input.selectionEnd ?? inputValue.length;
    const newValue = inputValue.slice(0, start) + emoji + inputValue.slice(end);
    setInputValue(newValue);
    // Move cursor after emoji
    requestAnimationFrame(() => {
      input.selectionStart = input.selectionEnd = start + emoji.length;
      input.focus();
    });
  }

  function applyCmdCompletion(cmd: typeof COMMANDS[number]) {
    setInputValue(cmd.name + ' ');
    setCmdVisible(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Command popup navigation
    if (cmdVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCmdSelectedIndex((prev) => (prev + 1) % cmdFiltered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCmdSelectedIndex((prev) => (prev - 1 + cmdFiltered.length) % cmdFiltered.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        applyCmdCompletion(cmdFiltered[cmdSelectedIndex]);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCmdCompletion(cmdFiltered[cmdSelectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setCmdVisible(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      const text = inputValue.trim();
      if (!text) return;

      setInputValue('');
      setCmdVisible(false);

      if (!handleCommand(text)) {
        sendChatMessage(text);
      }
    }
  }

  // ── Render empty state or chat ──
  const hasChannel = activeChannelId !== null;

  return (
    <>
      {/* Chat messages area or empty state */}
      {hasChannel ? (
        <>
          <main id="chatArea" ref={chatAreaRef} className="custom-scrollbar">
            {isLoadingMore && (
              <div style={{ textAlign: 'center', padding: '8px 0', opacity: 0.5 }}>
                <span className="msg-system">*** loading older messages...</span>
              </div>
            )}
            {!isLoadingMore && !hasMore && messages.length > 1 && (
              <div style={{ textAlign: 'center', padding: '8px 0', opacity: 0.3 }}>
                <span className="msg-system">*** beginning of history</span>
              </div>
            )}
            {messages.map((msg, index) => {
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const showDateSep = msg.date && (!prevMsg || prevMsg.date !== msg.date);
              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="date-separator">
                      <span className="date-separator-label">{formatDateLabel(msg.date)}</span>
                    </div>
                  )}
                  <div className="message-line">
                    {msg.type === 'system' ? (
                      <>
                        <span className="msg-system">*** {msg.text}</span>
                        <span className="msg-timestamp">[{msg.timestamp}]</span>
                      </>
                    ) : (
                      <>
                        <span className={`msg-username ${usernameStyle}${msg.type === 'bot' ? ' bot' : ''}`}>
                          {usernameStyle === 'traditional'
                            ? `<${msg.username.startsWith('@') ? msg.username : '@' + msg.username}>`
                            : msg.username.replace(/^@/, '')}
                        </span>
                        <span
                          className="msg-text"
                          dangerouslySetInnerHTML={{ __html: escapeHtml(msg.text) }}
                        />
                        <span className="msg-timestamp">[{msg.timestamp}]</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </main>

          {/* Theme toggle */}
          <div className="theme-toggle-container">
            <ThemeToggle />
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon material-icons">forum</div>
          <div className="empty-state-title">closechat</div>
          <div className="empty-state-hint">
            select a channel from the sidebar<br />
            or type <span className="empty-state-cmd">/join &lt;channel&gt;</span> to get started
          </div>
        </div>
      )}

      {/* Command autocomplete popup */}
      <div className={`cmd-popup${cmdVisible ? '' : ' hidden'}`}>
        {cmdFiltered.map((cmd, i) => (
          <div
            key={cmd.name}
            className={`cmd-item${i === cmdSelectedIndex ? ' selected' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              applyCmdCompletion(cmd);
            }}
          >
            <span className="cmd-name">{cmd.name}</span>
            {cmd.usage && <span className="cmd-usage">{cmd.usage}</span>}
            <span className="cmd-desc">{cmd.desc}</span>
          </div>
        ))}
      </div>

      {/* Input footer */}
      <footer id="footer">
        <div className="input-row">
          <div className="input-wrapper">
            <input
              type="text"
              id="messageInput"
              ref={inputRef}
              placeholder="type a message..."
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="input-actions-wrapper">
            <div className="input-actions">
              <button className="action-btn" onClick={() => setEmojiPickerOpen((v) => !v)}>
                <span className="material-icons">sentiment_satisfied</span>
              </button>
              <button className="action-btn">
                <span className="material-icons">photo_camera</span>
              </button>
              <button className="action-btn mic-btn">
                <span className="material-icons">mic</span>
              </button>
            </div>
            {emojiPickerOpen && (
              <EmojiPicker
                onSelect={insertEmoji}
                onClose={() => setEmojiPickerOpen(false)}
              />
            )}
          </div>
        </div>
      </footer>
    </>
  );
}

// ── Theme toggle sub-component ──
function ThemeToggle() {
  const { isDark, toggleTheme } = useApp();
  return (
    <button className="theme-toggle-btn" onClick={toggleTheme}>
      <span className="material-icons">
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
}
