import { useEffect, useCallback, useRef } from 'react';
import { getCurrentWindow, LogicalSize, PhysicalPosition } from '@tauri-apps/api/window';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
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
    displayMode,
    setDisplayMode,
  } = useApp();

  // Load users & members when people panel opens
  useEffect(() => {
    if (peopleOpen) {
      loadUsers();
      loadChannelMembers();
    }
  }, [peopleOpen, loadUsers, loadChannelMembers]);

  // Apply Tauri window settings when display mode changes
  useEffect(() => {
    const win = getCurrentWindow();
    if (displayMode === 'fullscreen') {
      win.setResizable(true).catch(console.error);
      win.setAlwaysOnTop(false).catch(console.error);
      win.maximize().catch(console.error);
    } else {
      win.setAlwaysOnTop(true).catch(console.error);
      win.unmaximize()
        .then(() => win.setSize(new LogicalSize(400, 500)))
        .then(() => win.setResizable(false))
        .catch(console.error);
    }
  }, [displayMode]);

  // Drag handler: call Tauri's startDragging on mousedown
  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left-click, and not on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('.status-group')) return;
    e.preventDefault();
    getCurrentWindow().startDragging();
  }, []);

  const handleMinimize = useCallback(() => {
    getCurrentWindow().minimize().catch(console.error);
  }, []);

  const handleHide = useCallback(() => {
    getCurrentWindow().hide().catch(console.error);
  }, []);

  // Compact mode: no startDragging on title bar (header below handles drag),
  // so onDoubleClick fires normally → expand to fullscreen.
  const handleTitleBarDoubleClick = useCallback(() => {
    setDisplayMode('fullscreen');
  }, [setDisplayMode]);

  // Track maximized state via resize events.
  const isMaximizedRef = useRef(true);
  useEffect(() => {
    if (displayMode !== 'fullscreen') return;
    const win = getCurrentWindow();
    win.isMaximized().then((m) => { isMaximizedRef.current = m; }).catch(console.error);
    let unlisten: (() => void) | null = null;
    win.onResized(async () => {
      isMaximizedRef.current = await win.isMaximized();
    }).then((fn) => { unlisten = fn; }).catch(console.error);
    return () => { unlisten?.(); };
  }, [displayMode]);

  // Manual drag state — used when window is restored so drag is instant.
  const isDraggingManually = useRef(false);
  const manualDragOrigin = useRef({ mouseX: 0, mouseY: 0, winX: 0, winY: 0 });
  const lastTitleClickTime = useRef(0);

  useEffect(() => {
    if (displayMode !== 'fullscreen') return;
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingManually.current) return;
      const scale = window.devicePixelRatio ?? 1;
      const newX = manualDragOrigin.current.winX + (e.screenX - manualDragOrigin.current.mouseX) * scale;
      const newY = manualDragOrigin.current.winY + (e.screenY - manualDragOrigin.current.mouseY) * scale;
      getCurrentWindow().setPosition(new PhysicalPosition(newX, newY)).catch(console.error);
    };
    const onMouseUp = () => { isDraggingManually.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [displayMode]);

  // Fullscreen title bar drag:
  //   - Maximized → native startDragging (instant, OS handles unmaximize + drag)
  //   - Restored  → manual drag via mousemove (instant), double-click within 350ms → maximize
  const handleTitleBarMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    e.preventDefault();
    if (isMaximizedRef.current) {
      getCurrentWindow().startDragging();
      return;
    }
    const now = Date.now();
    if (now - lastTitleClickTime.current < 350) {
      lastTitleClickTime.current = 0;
      getCurrentWindow().maximize().catch(console.error);
      return;
    }
    lastTitleClickTime.current = now;
    try {
      const pos = await getCurrentWindow().outerPosition();
      isDraggingManually.current = true;
      manualDragOrigin.current = { mouseX: e.screenX, mouseY: e.screenY, winX: pos.x, winY: pos.y };
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleMaximize = useCallback(() => {
    getCurrentWindow().maximize().catch(console.error);
  }, []);

  // Title bar always visible — controls only shown in fullscreen.
  const titleBar = (
    <div
      id="titleBar"
      onMouseDown={displayMode === 'fullscreen' ? handleTitleBarMouseDown : undefined}
      onDoubleClick={displayMode === 'compact' ? handleTitleBarDoubleClick : undefined}
    >
      <span className="title-bar-brand">closechat</span>
      {displayMode === 'fullscreen' && (
        <div className="title-bar-controls">
          <button className="title-bar-btn" onClick={handleMinimize} title="Minimize">
            <span className="material-icons">remove</span>
          </button>
          <button className="title-bar-btn" onClick={handleMaximize} title="Maximize">
            <span className="material-icons">crop_square</span>
          </button>
          <button className="title-bar-btn close" onClick={handleHide} title="Hide to tray">
            <span className="material-icons">close</span>
          </button>
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div id="contentWrapper">
        {displayMode === 'fullscreen' && titleBar}
        <AuthOverlay />
      </div>
    );
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
      {/* Custom title bar — fullscreen mode only */}
      {displayMode === 'fullscreen' && titleBar}

      {/* People Panel — above appContainer in compact, right column in fullscreen */}
      {displayMode === 'compact' && <PeoplePanel />}

      <div id="appContainer">
        {/* Sidebar */}
        <Sidebar />

        {/* Main chat panel */}
        <div id="chatPanel">
          {/* Header — draggable in compact mode */}
          <header
            id="header"
            onMouseDown={displayMode === 'compact' ? handleDragMouseDown : undefined}
          >
            <div className="header-left">
              {displayMode === 'compact' && (
                <button className="hamburger-btn" title="Toggle chats" onClick={toggleSidebar}>
                  <span className="material-icons">menu</span>
                </button>
              )}
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

        {/* People Panel — right column in fullscreen mode */}
        {displayMode === 'fullscreen' && <PeoplePanel />}
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    check().then((update) => {
      if (update) {
        console.log(`Update available: ${update.version}`);
        update.downloadAndInstall().then(() => relaunch()).catch(console.error);
      }
    }).catch(console.error);
  }, []);

  return <AppContent />;
}
