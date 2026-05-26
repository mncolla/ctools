import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('debugAPI', {
  readLogFile: () => ipcRenderer.invoke('debug:read-log-file'),
})
