import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ProtocolPayload, ScrapeResult } from '../shared/shared'

// Custom APIs for renderer
const api = {
  scrapeTwitter: (url: string): Promise<ScrapeResult> => ipcRenderer.invoke('scrape-twt', url),
  scrapeR34: (url: string): Promise<ScrapeResult> => ipcRenderer.invoke('scrape-r34', url),
  downloadFromUrl_YTDLP: (url: string): Promise<string[]> =>
    ipcRenderer.invoke('download-yt-dlp', url),
  get: (url: string) => ipcRenderer.invoke('api:get', url),
  post: (url: string, data: any) => ipcRenderer.invoke('api:post', url, data),
  postForm: (url: string, data: any) => ipcRenderer.invoke('api:postForm', url, data),
  delete: (url: string, data: any) => ipcRenderer.invoke('api:delete', url, data),
  put: (url: string, data: any) => ipcRenderer.invoke('api:put', url, data),
  onProtocolAction: (callback: (protocolPayload: ProtocolPayload) => void) =>
    ipcRenderer.on('protocol-action', (_event, protocolPayload) => callback(protocolPayload))
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
