import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useApp } from '../context/AppContext';

export default function MiniView() {
  const { channels } = useApp();
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const totalUnread = channels.reduce((sum, ch) => sum + (ch.unreadCount || 0), 0);

  useEffect(() => {
    if (totalUnread > 0) {
      setHasNewMessage(true);
    }
  }, [totalUnread]);

  const handleClick = async () => {
    setHasNewMessage(false);
    await getCurrentWindow().emit('restore-window');
  };

  return (
    <div className="mini-view" onClick={handleClick}>
      <div className="mini-logo">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>
      {(totalUnread > 0 || hasNewMessage) && (
        <div className={`mini-badge ${hasNewMessage ? 'pulse' : ''}`}>
          {totalUnread > 99 ? '99+' : totalUnread}
        </div>
      )}
    </div>
  );
}
