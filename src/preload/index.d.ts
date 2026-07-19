import { ElectronAPI } from '@electron-toolkit/preload'

type iapi = {
  scrapeTwitter: (url: string) => Promise<ScrapeResult>
  scrapeR34: (url: string) => Promise<ScrapeResult>
  downloadFromUrl_YTDLP: (url: string) => Promise<string[]>
  fetchFromApi: (apiUrl: string) => Promise<unknown>
  onProtocolAction: (callback: (protocolPayload: protocolPayload) => void) => void
  get: (url: string) => Promise<any>
  post: (url: string, data: any) => Promise<any>
  postForm: (url: string, data: any) => Promise<any>
  delete: (url: string, data?: any) => Promise<any>
  put: (url: string, data?: any) => Promise<any>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: iapi
  }
}
