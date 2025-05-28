import { BusinessInfo } from './types/business';
// Make this file a module to avoid global scope issues if it's not already.
export {}; 

// Define BusinessInfo here if it's not globally available or import it
// For simplicity, if BusinessInfo is complex and only used in App.tsx and preload for typing,
// you might consider a simpler type here or ensure consistent import paths.

declare global {
  interface Window {
    electron: {
      env: {
        getVars: () => Promise<{
          SUPABASE_URL?: string;
          SUPABASE_ANON_KEY?: string;
        }>;
      };
      ipcRenderer: {
        send: (channel: string, data: any) => void;
        on: (channel: string, func: (...args: any[]) => void) => () => void; // Returns a cleanup function
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        removeAllListeners: (channel: string) => void;
      };
      localStorage: {
        exportArchiveByDate: (businessList: BusinessInfo[]) => Promise<{ success: boolean; error?: string; filePath?: string }>;
      };
    };
  }
} 