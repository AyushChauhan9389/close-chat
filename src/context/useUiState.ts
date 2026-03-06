import { useCallback, useEffect, useState } from 'react';
import type { DisplayMode, UsernameStyle } from './chatUtils';

function setBodyClass(name: string, enabled: boolean) {
  document.body.classList.toggle(name, enabled);
}

export function useUiState() {
  const [isDark, setIsDark] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [prevDisplayMode, setPrevDisplayMode] = useState<DisplayMode>('compact');
  const [sidebarOpenState, setSidebarOpenState] = useState(false);
  const [peopleOpenState, setPeopleOpenState] = useState(false);
  const [usernameStyle, setUsernameStyleState] = useState<UsernameStyle>(() => {
    return (localStorage.getItem('closechat_username_style') as UsernameStyle) || 'geist-square';
  });
  const [displayModeState, setDisplayModeState] = useState<DisplayMode>(() => {
    return (localStorage.getItem('closechat_display_mode') as DisplayMode) || 'compact';
  });

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    setBodyClass('sidebar-open', open);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpenState((prev) => {
      const next = !prev;
      setBodyClass('sidebar-open', next);
      return next;
    });
  }, []);

  const setPeopleOpen = useCallback((open: boolean) => {
    setPeopleOpenState(open);
    setBodyClass('people-open', open);
  }, []);

  const togglePeople = useCallback(() => {
    setPeopleOpenState((prev) => {
      const next = !prev;
      setBodyClass('people-open', next);
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      setBodyClass('light', !next);
      return next;
    });
  }, []);

  const setUsernameStyle = useCallback((style: UsernameStyle) => {
    setUsernameStyleState(style);
    localStorage.setItem('closechat_username_style', style);
  }, []);

  const setDisplayMode = useCallback((mode: DisplayMode) => {
    setDisplayModeState(mode);
    localStorage.setItem('closechat_display_mode', mode);
    setBodyClass('fullscreen', mode === 'fullscreen');

    if (mode === 'fullscreen') {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
      setPeopleOpen(false);
    }
  }, [setPeopleOpen, setSidebarOpen]);

  useEffect(() => {
    const saved = localStorage.getItem('closechat_display_mode') as DisplayMode;
    if (saved === 'fullscreen') {
      setBodyClass('fullscreen', true);
      setSidebarOpen(true);
    }
  }, [setSidebarOpen]);

  return {
    isDark,
    toggleTheme,
    isMinimized,
    setIsMinimized,
    prevDisplayMode,
    setPrevDisplayMode,
    sidebarOpen: sidebarOpenState,
    setSidebarOpen,
    toggleSidebar,
    peopleOpen: peopleOpenState,
    setPeopleOpen,
    togglePeople,
    usernameStyle,
    setUsernameStyle,
    displayMode: displayModeState,
    setDisplayMode,
  };
}
