import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setMovable: (movable: boolean) => ipcRenderer.send('set-movable', movable),
  setIgnoreMouseEvents: (ignore: boolean, opts?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, opts),
  resizeWindow: (width: number, height: number) =>
    ipcRenderer.send('resize-window', width, height),
});
