import { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useApp } from '../context/AppContext';
import Ascii3 from './ascii-3ring';

export default function MiniView() {
  const { channels } = useApp();
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const prevUnreadRef = useRef(0);

  const totalUnread = channels.reduce((sum, ch) => sum + (ch.unreadCount || 0), 0);

  useEffect(() => {
    if (totalUnread > prevUnreadRef.current) {
      setHasNewMessage(true);
    }

    if (totalUnread === 0) {
      setHasNewMessage(false);
    }

    prevUnreadRef.current = totalUnread;
  }, [totalUnread]);

  const handleClick = async () => {
    setHasNewMessage(false);
    await getCurrentWindow().emit('restore-window');
  };

  return (
    <div className="mini-view" onClick={handleClick}>
      <div className="mini-logo">
        <Ascii3 compact />
      </div>
      {(totalUnread > 0 || hasNewMessage) && (
        <div className={`mini-badge ${hasNewMessage ? 'pulse' : ''}`}>
          {totalUnread > 99 ? '99+' : totalUnread}
        </div>
      )}
    </div>
  );
}
