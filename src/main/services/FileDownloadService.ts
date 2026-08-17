import path from 'path'
import { FileDownloadResult, VideoInfo } from '../../shared/types/models'
import { mediaTypeFromExt } from '../../shared/utils/mediaType'
import fs from 'fs'
import { execFile, spawn } from 'child_process'
import { Result } from '../../shared/types/api'

function getVideoInfo(url: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
        execFile('yt-dlp', ['--dump-json', url], (error, stdout) => {
            if (error) return reject(error)

            try {
                const info = JSON.parse(stdout)
                console.log({ info })
                resolve({
                    title: info.title,
                    thumbnailUrl: info.thumbnail,
                    duration: info.duration,
                    ext: info.ext,
                    tags: info.tags,
                    mediaType: mediaTypeFromExt(info.ext)
                })
            } catch (err) {
                reject(err)
            }
        })
    })
}

export async function downloadFile(
    url: string,
    outputDir: string,
    onProgress?: (percent: number) => void,
    onInfo?: (data: VideoInfo) => void
): Promise<Result<FileDownloadResult>> {
    const videoInfo = await getVideoInfo(url)
    console.log(videoInfo)

    onInfo?.(videoInfo)

    return new Promise((resolve, reject) => {
        const fileName = `${crypto.randomUUID()}_temp`

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        const outputTemplate = path.join(outputDir, `${fileName}.${videoInfo.ext}`)
        const args = ['-o', outputTemplate, '--newline', url]
        const ytdlp = spawn('yt-dlp', args)

        let errorLog = ''
        ytdlp.stderr.on('data', (data) => {
            errorLog += data.toString()
        })

        ytdlp.stdout.on('data', (data) => {
            const output = data.toString()

            const percentMatch = output.match(/\[download\]\s+(\d+\.\d+)%/)
            if (percentMatch) {
                const percentage = parseFloat(percentMatch[1])
                onProgress?.(percentage)
            }
        })

        ytdlp.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, data: { filePath: outputTemplate } })
            } else {
                reject(new Error(`yt-dlp failed with code ${code}:\n${errorLog}`))
            }
        })

        ytdlp.on('error', (err) => {
            reject(new Error(`Failed to start yt-dlp process: ${err.message}`))
        })
    })
}
