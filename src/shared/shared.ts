import { UUID } from 'crypto'

export type ProtocolPayload = {
  rawUrl: string
  parsedUrl?: URL
  params: { [k: string]: string }
}

export enum Site {
  LOCAL = 'local',
  TWITTER = 'twitter',
  PINTEREST = 'pinterest',
  R34 = 'r34'
}

export enum MediaType {
  VIDEO = 'video',
  IMAGE = 'image',
  UNSUPPORTED = 'unsupported',
  UNDEFINED = 'undefined'
}

export function mimeTypeToMediaType(mimeType: String): MediaType {
  if (mimeType.includes(MediaType.VIDEO)) return MediaType.VIDEO
  else if (mimeType.includes(MediaType.IMAGE)) return MediaType.IMAGE
  else return MediaType.UNSUPPORTED
}

export class ScrapeResult {
  titleWords: string[] = []
  authorDisplayName: string = ''
  authorSocialHandle: string = ''
  videoPath?: string = undefined
  highResImgUrl?: string = undefined
  altSources: string[] = []
  groupTagMap: GroupTagMap = new GroupTagMap()
}

export function isTwitterUrl(url: string) {
  const twitterRegex = /https:\/\/x\.com\/.+/g
  return twitterRegex.test(url)
}

export function isPinterestUrl(url: string) {
  const twitterRegex = /https:\/\/pinterest\.com\/.+/g
  return twitterRegex.test(url)
}

export function isR34Url(url: string) {
  const twitterRegex = /https:\/\/rule34\.xxx\/.+/g
  return twitterRegex.test(url)
}

export class DroppedFileData implements Selectable {
  id: UUID = crypto.randomUUID()
  fileName: string = ''
  sourceUrl: string = ''
  altSources: string[] = []
  userName: string = ''
  socialHandle: string = ''
  authorUrl: string = ''
  postTitle: string = ''
  fileUrl: string = ''
  thumbnailUrl: string = ''
  // @ts-ignore
  file: File = null
  mediaType: MediaType = MediaType.UNSUPPORTED
  pendingFile: boolean = true
  pendingScrape: boolean = true
  pendingUpload: boolean = false
  uploaded: boolean = false
  error: boolean = false
  selected: boolean = false
  groupTagMap: GroupTagMap = new GroupTagMap()
  errorMessage: any

  updateMediaType() {
    let type = this.file.type.split('/')[0]

    switch (type) {
      case MediaType.IMAGE:
        this.mediaType = MediaType.IMAGE
        break
      case MediaType.VIDEO:
        this.mediaType = MediaType.VIDEO
        break
      default:
        this.mediaType = MediaType.UNSUPPORTED
        break
    }

    if (type == MediaType.IMAGE) this.mediaType = MediaType.IMAGE
    else if (type == MediaType.VIDEO) this.mediaType = MediaType.VIDEO
    else this.mediaType = MediaType.UNSUPPORTED
  }
}

export const twitterHighResSuffix = '?format=jpg&name=large'
export const twitterLowResSuffix = '?format=jpg&name=small'
