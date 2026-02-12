import { useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useApp } from './context/AppContext';
import AuthOverlay from './components/AuthOverlay';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import PeoplePanel from './components/PeoplePanel';

function AppContent() {
  const {
    isAuthenticated,
    currentUser,
    activeChannel,
    toggleSidebar,
    togglePeople,
    allUsers,
    peopleOpen,
    loadUsers,
    loadChannelMembers,
  } = useApp();

  // Load users & members when people panel opens
  useEffect(() => {
    if (peopleOpen) {
      loadUsers();
      loadChannelMembers();
    }
  }, [peopleOpen, loadUsers, loadChannelMembers]);

  // Drag handler: call Tauri's startDragging on mousedown
  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left-click, and not on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('.status-group')) return;
    e.preventDefault();
    getCurrentWindow().startDragging();
  }, []);

  if (!isAuthenticated) {
    return <AuthOverlay />;
  }

  // Channel display name for header
  const channelDisplayName = activeChannel
    ? activeChannel.type === 'dm'
      ? activeChannel.recipient
        ? `@${activeChannel.recipient.username}`
        : `@${activeChannel.name}`
      : `#${activeChannel.name}`
    : '';

  const onlineCount = allUsers.filter((u) => u.status === 'online').length;

  return (
    <div id="contentWrapper">
      {/* People Panel (above appContainer) */}
      <PeoplePanel />

      <div id="appContainer">
        {/* Sidebar */}
        <Sidebar />

        {/* Main chat panel */}
        <div id="chatPanel">
          {/* Header — draggable region for frameless window */}
          <header id="header" onMouseDown={handleDragMouseDown}>
            <div className="header-left">
              <button className="hamburger-btn" title="Toggle chats" onClick={toggleSidebar}>
                <span className="material-icons">menu</span>
              </button>
              <span className="brand">
                closechat / <span className="username">@{currentUser?.username || 'anon'}</span>
              </span>
            </div>
            <div className="header-right">
              <span className="channel">{channelDisplayName}</span>
              <div className="status-group" title="Show online users" onClick={togglePeople}>
                <div className="status-dot"></div>
                <span className="material-icons user-icon">group</span>
                <span className="user-count">{onlineCount}</span>
              </div>
            </div>
          </header>

          {/* Chat area content (messages, commands, footer) */}
          <ChatArea />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
