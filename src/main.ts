import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';

app.commandLine.appendSwitch("disable-http-cache");
app.commandLine.appendSwitch("disk-cache-size", "0");

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow;

// Fixed max dimensions — window never resizes
const MAX_WIDTH = 650;
const MAX_HEIGHT = 750;

const createWindow = () => {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: MAX_WIDTH,
    height: MAX_HEIGHT,
    x: screenW - MAX_WIDTH,
    y: screenH - MAX_HEIGHT,
    skipTaskbar: true,
    movable: false,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open dev tools if OPEN_DEVTOOLS environment variable is set
  // if (process.env.OPEN_DEVTOOLS === 'true') {
  //   mainWindow.webContents.openDevTools();
  // }
};

ipcMain.on('set-movable', (_event, movable: boolean) => {
  if (mainWindow) {
    mainWindow.setMovable(movable);
  }
});

ipcMain.on('set-ignore-mouse-events', (_event, ignore: boolean, opts?: { forward: boolean }) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, opts);
  }
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
