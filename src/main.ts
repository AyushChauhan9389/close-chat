import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow;

const COLLAPSED_WIDTH = 400;
const EXPANDED_WIDTH = 650;
const WINDOW_HEIGHT = 500;
const PEOPLE_PANEL_HEIGHT = 250;
const EXPANDED_HEIGHT = WINDOW_HEIGHT + PEOPLE_PANEL_HEIGHT; // 750px
let sidebarOpen = false;
let peopleOpen = false;

const createWindow = () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: COLLAPSED_WIDTH,
    height: WINDOW_HEIGHT,
    x: width - COLLAPSED_WIDTH,
    y: height - WINDOW_HEIGHT,
    skipTaskbar: true,
    movable: false,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

ipcMain.on('set-movable', (_event, movable: boolean) => {
  if (mainWindow) {
    mainWindow.setMovable(movable);
  }
});

function applyWindowBounds(): void {
  if (!mainWindow) return;
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  const w = sidebarOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
  const h = peopleOpen ? EXPANDED_HEIGHT : WINDOW_HEIGHT;
  const x = screenW - w;
  const y = screenH - h;

  mainWindow.setBounds({ x, y, width: w, height: h }, true);
}

ipcMain.handle('toggle-sidebar', () => {
  if (!mainWindow) return sidebarOpen;
  sidebarOpen = !sidebarOpen;
  applyWindowBounds();
  return sidebarOpen;
});

ipcMain.handle('toggle-people', () => {
  if (!mainWindow) return peopleOpen;
  peopleOpen = !peopleOpen;
  applyWindowBounds();
  return peopleOpen;
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
