import fs from 'fs'
import path from 'path'
import { PrismaClient } from '../../generated/prisma/client'
import { Result } from '../../shared/types/api'
import { Canvas, CanvasSceneData } from '../../shared/types/models'

export class CanvasService {
    private canvasesDir: string

    constructor(
        private prisma: PrismaClient,
        canvasesDir: string
    ) {
        this.canvasesDir = canvasesDir
        fs.mkdirSync(this.canvasesDir, { recursive: true })
    }

    private dataFilePath(id: number) {
        return path.join(this.canvasesDir, `canvas-${id}.json`)
    }

    private writeJsonAtomic(filePath: string, data: unknown) {
        const tmp = filePath + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
        fs.renameSync(tmp, filePath)
    }

    toCanvas(row: {
        id: number
        name: string
        dataPath: string
        createdAt: Date | string
        updatedAt: Date | string
    }): Canvas {
        return {
            id: row.id,
            name: row.name,
            dataPath: row.dataPath,
            createdAt:
                row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
            updatedAt:
                row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt)
        }
    }

    async createCanvas(name: string, data: CanvasSceneData): Promise<Result<Canvas>> {
        let row:
            | { id: number; name: string; dataPath: string; createdAt: Date; updatedAt: Date }
            | undefined
        try {
            const filePath = this.dataFilePath(-1)
            row = await this.prisma.canvas.create({
                data: { name, dataPath: filePath }
            })

            const actualPath = this.dataFilePath(row.id)
            await this.prisma.canvas.update({
                where: { id: row.id },
                data: { dataPath: actualPath }
            })

            this.writeJsonAtomic(actualPath, data)

            return { success: true, data: this.toCanvas({ ...row, dataPath: actualPath }) }
        } catch (err: any) {
            if (err?.code === 'P2002') {
                return { success: false, error: 'Canvas name already exists.' }
            }
            if (row?.id) {
                try {
                    await this.prisma.canvas.delete({ where: { id: row.id } })
                } catch {
                    // best effort cleanup
                }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to create canvas.'
            }
        }
    }

    async getAllCanvases(): Promise<Result<Canvas[]>> {
        try {
            const rows = await this.prisma.canvas.findMany({
                orderBy: { updatedAt: 'desc' }
            })
            return { success: true, data: rows.map((r) => this.toCanvas(r)) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get canvases.'
            }
        }
    }

    async getCanvasesByIds(ids: number[]): Promise<Result<Array<[number, Canvas]>>> {
        try {
            const rows = await this.prisma.canvas.findMany({
                where: { id: { in: ids } }
            })
            const entries: Array<[number, Canvas]> = rows.map((r) => [r.id, this.toCanvas(r)])
            return { success: true, data: entries }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get canvases by ids.'
            }
        }
    }

    async getCanvas(id: number): Promise<Result<{ meta: Canvas; data: CanvasSceneData }>> {
        try {
            const row = await this.prisma.canvas.findUnique({ where: { id } })
            if (!row) {
                return { success: false, error: `Canvas with id=${id} not found.` }
            }

            let raw: string
            try {
                raw = fs.readFileSync(row.dataPath, 'utf-8')
            } catch (err: any) {
                if (err?.code === 'ENOENT') {
                    return { success: false, error: `Canvas data file not found: ${row.dataPath}` }
                }
                throw err
            }

            let parsed: CanvasSceneData
            try {
                parsed = JSON.parse(raw)
            } catch {
                return { success: false, error: 'Failed to parse canvas data file.' }
            }

            return { success: true, data: { meta: this.toCanvas(row), data: parsed } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get canvas.'
            }
        }
    }

    async updateCanvasName(id: number, name: string): Promise<Result<Canvas>> {
        try {
            const row = await this.prisma.canvas.update({
                where: { id },
                data: { name }
            })
            return { success: true, data: this.toCanvas(row) }
        } catch (err: any) {
            if (err?.code === 'P2002') {
                return { success: false, error: 'Canvas name already exists.' }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to rename canvas.'
            }
        }
    }

    async updateCanvasData(id: number, data: CanvasSceneData): Promise<Result<void>> {
        try {
            const row = await this.prisma.canvas.findUnique({
                where: { id },
                select: { dataPath: true }
            })
            if (!row) {
                return { success: false, error: `Canvas with id=${id} not found.` }
            }

            this.writeJsonAtomic(row.dataPath, data)
            await this.prisma.canvas.update({
                where: { id },
                data: { updatedAt: new Date() }
            })

            return { success: true, data: undefined as void }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to save canvas data.'
            }
        }
    }

    async deleteCanvas(id: number): Promise<Result<void>> {
        try {
            const row = await this.prisma.canvas.findUnique({
                where: { id },
                select: { dataPath: true }
            })
            if (!row) {
                return { success: false, error: `Canvas with id=${id} not found.` }
            }

            try {
                fs.unlinkSync(row.dataPath)
            } catch (err: any) {
                if (err?.code !== 'ENOENT') throw err
            }

            await this.prisma.canvas.delete({ where: { id } })

            return { success: true, data: undefined as void }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to delete canvas.'
            }
        }
    }
}
