import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setMovable: (movable: boolean) => ipcRenderer.send('set-movable', movable),
  toggleSidebar: (): Promise<boolean> => ipcRenderer.invoke('toggle-sidebar'),
});
