import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs'; // Import Node.js file system module
import started from 'electron-squirrel-startup';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import { 
  OPEN_MAP_WINDOW,
  EXPORT_ARCHIVE_BY_DATE
} from './ipcChannels'; // Import channel names
import { BusinessInfo } from './types/business'; // Assuming types are accessible here or define a simpler one

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// const localStoreFileName = 'localBusinessList.json'; // No longer needed

// Moved createWindow outside 'ready' to be callable, but it will be called from 'ready'
let mainWindow: BrowserWindow | null = null;
let mapWindow: BrowserWindow | null = null; // Keep a reference to the map window

const createWindowAndSetupHandlers = () => {
  // const userDataPath = app.getPath('userData'); // No longer needed for local store
  // const localStoreFilePath = path.join(userDataPath, localStoreFileName); // No longer needed

  // === Setup IPC Handlers ===

  // IPC Handler for getting environment variables securely
  ipcMain.handle('get-env-vars', () => {
    return {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    };
  });

  // Removed ipcMain.handle(SAVE_BUSINESS_LIST_LOCAL, ...);
  // Removed ipcMain.handle(LOAD_BUSINESS_LIST_LOCAL, ...);
  // Removed ipcMain.handle(CLEAR_BUSINESS_LIST_LOCAL, ...);
  // Removed ipcMain.handle(EXPORT_SESSION_TO_JSON, ...);

  // IPC Handler for exporting Supabase archive data by date (This one STAYS)
  ipcMain.handle(EXPORT_ARCHIVE_BY_DATE, async (_event, businessList: BusinessInfo[]) => {
    const transformedList = businessList.map(b => ({
      "ADDRESS": b.address || "",
      "REGION": "",
      "LAND_SIZE_SF": "",
      "YEAR_OF_CONSTRUCTION": "",
      "BUSINESS_NAME": b.name || "",
      "LICENSE_TYPES": "",
      "POINT": b.coordinates ? `${b.coordinates.lat}, ${b.coordinates.lng}` : "",
      "REVIEWS": "",
      "PERPLEX": "",
      "OLD_PERPLEX_RESEARCH": "",
      "AI_SUMMARY": "",
      "phoneNum": b.phone || "",
      "WEBSITE": b.website || "",
      "RATING_NUM": 0,
      "ALTERNATIVE_NAMES": ""
    }));
    const currentWindow = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!currentWindow) {
      return { success: false, error: 'No focused window to show save dialog.' };
    }
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(currentWindow, {
        title: 'Save Archive Export as JSON',
        defaultPath: `archive_export_${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (canceled || !filePath) {
        console.log('Archive JSON export canceled by user.');
        return { success: false, error: 'Export canceled by user.' };
      }
      fs.writeFileSync(filePath, JSON.stringify(transformedList, null, 2));
      console.log('Archive exported to JSON:', filePath);
      return { success: true, filePath };
    } catch (error) {
      console.error('Error exporting archive to JSON:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // === IPC Handler for opening map window ===
  ipcMain.on(OPEN_MAP_WINDOW, () => {
    if (mapWindow && !mapWindow.isDestroyed()) {
      mapWindow.focus();
      return;
    }
    mapWindow = new BrowserWindow({
      width: 900,
      height: 700,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const mapUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL
      ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL}?view=map`
      : `file://${path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)}?view=map`;

    mapWindow.loadURL(mapUrl);

    mapWindow.webContents.openDevTools(); // Uncomment for debugging the map window

    mapWindow.on('closed', () => {
      mapWindow = null;
    });
  });

  // === Now Create the Window ===
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindowAndSetupHandlers);

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
  if (mainWindow === null) {
    createWindowAndSetupHandlers();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
