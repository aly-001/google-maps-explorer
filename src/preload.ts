// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { 
  OPEN_MAP_WINDOW,
  EXPORT_ARCHIVE_BY_DATE
} from './ipcChannels';
import { BusinessInfo } from './types/business'; // Using BusinessInfo directly

export interface LocalStorageApi {
  exportArchiveByDate: (businessList: BusinessInfo[]) => Promise<{ success: boolean; error?: string; filePath?: string }>;
}

// It's good practice to strongly type the exposed API
// if you have a global.d.ts file, ensure it matches this structure.
export interface ElectronApi {
  env: {
    getVars: () => Promise<{
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
    }>;
  };
  ipcRenderer: {
    send: (channel: string, data?: any) => void; // Make data optional for send
    on: (channel: string, func: (...args: any[]) => void) => () => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    removeAllListeners: (channel: string) => void; 
  };
  localStorage: LocalStorageApi;
}

const electronApi: ElectronApi = {
  env: {
    getVars: () => ipcRenderer.invoke('get-env-vars'),
  },
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) => {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
  localStorage: {
    exportArchiveByDate: (businessList: BusinessInfo[]) => ipcRenderer.invoke(EXPORT_ARCHIVE_BY_DATE, businessList)
  }
};

contextBridge.exposeInMainWorld('electron', electronApi);

// Also, ensure your global.d.ts reflects this structure for TypeScript to recognize window.electron
