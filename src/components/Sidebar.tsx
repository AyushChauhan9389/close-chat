import { useState, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useApp } from '../context/AppContext';
import type { Channel } from '../lib/api';
import type { UsernameStyle } from '../context/AppContext';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'yday';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getChannelDisplayName(ch: Channel): string {
  if (ch.type === 'dm') {
    return ch.recipient ? `@${ch.recipient.username}` : `@${ch.name}`;
  }
  return `#${ch.name}`;
}

const FONT_OPTIONS: { value: UsernameStyle; label: string; fontClass: string }[] = [
  { value: 'geist-square', label: 'Geist Square', fontClass: 'geist-square' },
  { value: 'geist-grid', label: 'Geist Grid', fontClass: 'geist-grid' },
  { value: 'geist-circle', label: 'Geist Circle', fontClass: 'geist-circle' },
  { value: 'geist-triangle', label: 'Geist Triangle', fontClass: 'geist-triangle' },
  { value: 'geist-line', label: 'Geist Line', fontClass: 'geist-line' },
  { value: 'traditional', label: 'Traditional (<@user>)', fontClass: 'traditional' },
];

export default function Sidebar() {
  const { channels, activeChannelId, switchToChannel, setSidebarOpen, usernameStyle, setUsernameStyle } = useApp();
  const [searchFilter, setSearchFilter] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const filtered = searchFilter
    ? channels.filter((ch) => {
        const q = searchFilter.toLowerCase();
        if (ch.name.toLowerCase().includes(q)) return true;
        if (ch.type === 'dm' && ch.recipient && ch.recipient.username.toLowerCase().includes(q)) return true;
        return false;
      })
    : channels;

  function handleClose() {
    setSidebarOpen(false);
    document.body.classList.remove('sidebar-open');
  }

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    e.preventDefault();
    getCurrentWindow().startDragging();
  }, []);

  return (
    <aside id="sidebar" className="custom-scrollbar">
      <div className="sidebar-header" onMouseDown={handleDragMouseDown}>
        <span className="sidebar-title">{showSettings ? 'settings' : 'chats'}</span>
        <div className="sidebar-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="sidebar-close-btn" 
            onClick={() => setShowSettings(!showSettings)}
            title={showSettings ? 'Back to chats' : 'Settings'}
          >
            <span className="material-icons">{showSettings ? 'arrow_back' : 'settings'}</span>
          </button>
          <button className="sidebar-close-btn" onClick={handleClose} title="Close sidebar">
            <span className="material-icons">close</span>
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="settings-pane" style={{ padding: '16px' }}>
          <div className="setting-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#fb923c', fontSize: '12px', fontWeight: 500, marginBottom: '12px' }}>
              Username Style
            </label>
            <div className="setting-options" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {FONT_OPTIONS.map((opt) => (
                <label 
                  key={opt.value}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    cursor: 'pointer', 
                    color: 'inherit', 
                    fontSize: '13px' 
                  }}
                >
                  <input
                    type="radio"
                    name="usernameStyle"
                    value={opt.value}
                    checked={usernameStyle === opt.value}
                    onChange={() => setUsernameStyle(opt.value)}
                    style={{ accentColor: '#fb923c' }}
                  />
                  <span className={`msg-username ${opt.fontClass}`} style={{ fontSize: opt.value === 'traditional' ? '13px' : '12px' }}>
                    {opt.value === 'traditional' ? '<@username>' : 'username'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div id="chatList" className="chat-list">
          {/* Search bar */}
          <div className="sidebar-search-wrap">
            <span className="sidebar-search-icon material-icons">search</span>
            <input
              type="text"
              className="sidebar-search-input"
              placeholder="search chats..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>

          {filtered.length === 0 && searchFilter && (
            <div className="sidebar-no-results">no matches</div>
          )}

          {filtered.map((ch) => {
            const displayName = getChannelDisplayName(ch);
            const initials = ch.type === 'dm' && ch.recipient
              ? ch.recipient.username.slice(0, 2).toUpperCase()
              : ch.name.slice(0, 2).toUpperCase();
            const lastMsg = ch.lastMessage;
            const preview = lastMsg ? lastMsg.content : '';
            const time = lastMsg?.createdAt ? formatTime(lastMsg.createdAt) : '';
            const unread = ch.unreadCount || 0;

            return (
              <div
                key={ch.id}
                className={`chat-item${ch.id === activeChannelId ? ' active' : ''}`}
                onClick={() => switchToChannel(ch)}
              >
                <div className="chat-item-avatar">{initials}</div>
                <div className="chat-item-info">
                  <div className="chat-item-name">{displayName}</div>
                  <div
                    className="chat-item-preview"
                    dangerouslySetInnerHTML={{ __html: escapeHtml(preview) }}
                  />
                </div>
                <div className="chat-item-meta">
                  <span className="chat-item-time">{time}</span>
                  {unread > 0 && <div className="chat-item-badge">{unread}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
