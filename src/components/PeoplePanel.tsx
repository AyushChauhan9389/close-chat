import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../lib/api';
import type { User } from '../lib/api';

interface PersonEntry {
  id: number;
  name: string;
  status: 'online' | 'idle' | 'offline';
  role?: string;
  isSelf?: boolean;
  isBot?: boolean;
  isAdmin?: boolean;
}

export default function PeoplePanel() {
  const {
    currentUser,
    allUsers,
    channelMembers,
    myRoleInChannel,
    activeChannelId,
    addMessage,
    loadChannelMembers,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[] | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build people list
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
  const order: Record<string, number> = { online: 0, idle: 1, offline: 2 };
  people.sort((a, b) => {
    if (a.isSelf) return -1;
    if (b.isSelf) return 1;
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return (order[a.status] ?? 2) - (order[b.status] ?? 2);
  });

  const onlineCount = people.filter((p) => p.status === 'online').length;

  // Search debounce
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await api.searchUsers(searchQuery.trim());
        setSearchResults(results);
      } catch {
        // Silently fail
      }
    }, 300);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  function handleKick(username: string) {
    if (!activeChannelId) return;
    const member = channelMembers.find(
      (m) => m.username.toLowerCase() === username.toLowerCase()
    );
    if (!member) {
      addMessage('', `system: @${username} is not a member of this channel`, 'system');
      return;
    }
    api.removeMember(activeChannelId, member.id)
      .then(() => {
        addMessage('', `system: @${member.username} removed from the channel`, 'system');
        loadChannelMembers();
      })
      .catch((err: Error) => {
        addMessage('', `system: Failed to kick @${username}: ${err.message}`, 'system');
      });
  }

  function handleAddFromSearch(user: User) {
    if (!activeChannelId) return;
    api.addMember(activeChannelId, user.id)
      .then(() => {
        addMessage('', `system: @${user.username} added to the channel`, 'system');
        loadChannelMembers();
      })
      .catch((err: Error) => {
        addMessage('', `system: Failed to add @${user.username}: ${err.message}`, 'system');
      });
  }

  return (
    <div id="peoplePanel">
      <div className="people-header">
        <span className="people-title">online</span>
        <span className="people-count">{onlineCount} online</span>
      </div>
      <div className="people-list custom-scrollbar">
        {/* Search bar */}
        <div className="people-search-wrap">
          <span className="people-search-icon material-icons">search</span>
          <input
            type="text"
            className="people-search-input"
            placeholder="search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Search results mode */}
        {searchResults !== null ? (
          <>
            {searchResults.length === 0 ? (
              <div className="person-item search-result">
                <span className="msg-system" style={{ fontSize: '11px' }}>no matches</span>
              </div>
            ) : (
              searchResults.map((u) => {
                const isSelf = currentUser ? u.id === currentUser.id : false;
                let nameClass = 'person-name';
                if (isSelf) nameClass += ' is-self';

                return (
                  <div
                    key={u.id}
                    className="person-item search-result"
                    style={myRoleInChannel === 'admin' && activeChannelId && !isSelf ? { cursor: 'pointer' } : undefined}
                    title={myRoleInChannel === 'admin' && activeChannelId && !isSelf ? 'Click to add to channel' : undefined}
                    onClick={() => {
                      if (myRoleInChannel === 'admin' && activeChannelId && !isSelf) {
                        handleAddFromSearch(u);
                      }
                    }}
                  >
                    <div className={`person-status ${u.status || 'offline'}`}></div>
                    <span className={nameClass}>@{u.username}</span>
                    <span className="person-role">{u.status || 'offline'}</span>
                  </div>
                );
              })
            )}
          </>
        ) : (
          /* Normal people list */
          people.map((person) => {
            let nameClass = 'person-name';
            if (person.isBot) nameClass += ' is-bot';
            if (person.isSelf) nameClass += ' is-self';

            const canKick = myRoleInChannel === 'admin' && !person.isSelf && !person.isAdmin;

            return (
              <div
                key={person.id}
                className="person-item"
                style={canKick ? { cursor: 'pointer' } : undefined}
                title={canKick ? 'Right-click to kick' : undefined}
                onContextMenu={(e) => {
                  if (canKick) {
                    e.preventDefault();
                    const username = person.name.replace(/^@/, '');
                    if (confirm(`Kick @${username} from the channel?`)) {
                      handleKick(username);
                    }
                  }
                }}
              >
                <div className={`person-status ${person.status}`}></div>
                <span className={nameClass}>{person.name}</span>
                {person.isAdmin && <span className="person-admin-badge">admin</span>}
                {person.role && <span className="person-role">{person.role}</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
