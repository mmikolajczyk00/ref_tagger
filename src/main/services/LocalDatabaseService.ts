// main/services/DatabaseService.ts
import Database from 'better-sqlite3'
import path from 'path'
import schemaString from './schema.sql?raw'
import { Result } from '../../shared/types/api'
import {
    MediaFile,
    PaginatedResult,
    Tag,
    TagOperation,
    UploadFilePayload
} from '../../shared/types/models'

interface SQLiteMediaFileRaw extends Omit<MediaFile, 'tags'> {
    tagsJson: string
}

export class LocalDatabaseService {
    private db: Database.Database

    private stmts: {
        getFilesPaginated: Database.Statement
        getFileById: Database.Statement
        countFiles: Database.Statement
    }

    constructor(dbFolderPath: string) {
        const dbPath = path.join(dbFolderPath, 'ref-sheeter.sqlite')
        this.db = new Database(dbPath)

        this.initDatabase()

        this.db.pragma('journal_mode = WAL')
        this.db.pragma('foreign_keys = ON')

        this.stmts = {
            getFilesPaginated: this.db.prepare(`
        SELECT
          id,
          file_path AS filePath,
          file_name AS fileName,
          media_type AS mediaType,
          created_at AS createdAt,
          COALESCE(
            (
              SELECT json_group_array(
                json_object('id', t.id, 'name', t.name, 'color', t.color)
              )
              FROM file_tags ft
              JOIN tags t ON ft.tag_id = t.id
              WHERE ft.file_id = f.id
            ),
            '[]'
          ) AS tagsJson
        FROM files f
        ORDER BY created_at DESC
        LIMIT @limit OFFSET @offset
      `),
            getFileById: this.db.prepare(`
        SELECT
          id,
          file_path AS filePath,
          file_name AS fileName,
          media_type AS mediaType,
          created_at AS createdAt,
          COALESCE(
            (
              SELECT json_group_array(
                json_object('id', t.id, 'name', t.name, 'color', t.color)
              )
              FROM file_tags ft
              JOIN tags t ON ft.tag_id = t.id
              WHERE ft.file_id = f.id
            ),
            '[]'
          ) AS tagsJson
        FROM files f
        WHERE f.id = ?
      `),
            countFiles: this.db.prepare(`SELECT COUNT(*) as count FROM files`)
        }
    }
    private initDatabase() {
        try {
            this.db.exec(schemaString)
        } catch (error) {
            console.error('Failed to initialize database schema:', error)
        }
    }

    public getFiles(page: number, limit: number): Result<PaginatedResult<MediaFile>> {
        try {
            const offset = (page - 1) * limit

            const rows = this.stmts.getFilesPaginated.all({ limit, offset }) as SQLiteMediaFileRaw[]
            const totalRow = this.stmts.countFiles.get() as { count: number }

            const data: MediaFile[] = rows.map((row) => {
                const { tagsJson, ...fileData } = row
                return {
                    ...fileData,
                    tags: JSON.parse(tagsJson)
                }
            })

            return {
                success: true,
                data: {
                    data,
                    total: totalRow.count,
                    page,
                    limit
                }
            }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get files.'
            }
        }
    }

    public getFilesByIds(ids: number[]): Result<MediaFile[]> {
        if (!ids.length)
            return {
                success: true,
                data: []
            }
        try {
            const placeholders = ids.map(() => '?').join(',')

            const query = `
            SELECT
              f.id,
              f.file_path AS filePath,
              f.file_name AS fileName,
              f.media_type AS mediaType,
              f.created_at AS createdAt,
              COALESCE(
                (
                  SELECT json_group_array(
                    json_object('id', t.id, 'name', t.name, 'color', t.color)
                  )
                  FROM file_tags ft
                  JOIN tags t ON ft.tag_id = t.id
                  WHERE ft.file_id = f.id
                ),
                '[]'
              ) AS tagsJson
            FROM files f
            LEFT JOIN file_tags ft ON f.id = ft.file_id
            LEFT JOIN tags t ON ft.tag_id = t.id
            WHERE f.id IN (${placeholders})
            GROUP BY f.id
          `

            const rows = this.db.prepare(query).all(...ids) as any[]

            return {
                success: true,
                data: rows.map((row) => {
                    const { tagsJson, ...fileData } = row
                    console.log('row', row, 'tagsJson', tagsJson, 'parsed', JSON.parse(tagsJson))

                    return {
                        ...fileData,
                        tags: JSON.parse(tagsJson)
                    }
                })
            }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get files.'
            }
        }
    }

    public processTagOperations(
        operations: TagOperation[]
    ): Result<{ files: MediaFile[]; tags: Tag[] }> {
        try {
            const insertTagStmt = this.db.prepare(`
          INSERT INTO tags (name, color) VALUES (?, '#808080')
          ON CONFLICT(name) DO UPDATE SET name=name RETURNING id
        `)

            const addFileTagStmt = this.db.prepare(`
          INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)
        `)

            const removeFileTagStmt = this.db.prepare(`
          DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?
        `)

            const affectedFileIds = [...new Set(operations.map((op) => op.fileId))]
            const changedTags: Tag[] = []

            const changed = this.db.transaction((ops: TagOperation[]) => {
                for (const op of ops) {
                    if (op.action === 'add' && op.tagName) {
                        const tag = insertTagStmt.get(op.tagName) as { id: number }
                        addFileTagStmt.run(op.fileId, tag.id)
                        changedTags.push({ id: tag.id, name: op.tagName })
                    } else if (op.action === 'remove' && op.tagId) {
                        removeFileTagStmt.run(op.fileId, op.tagId)
                    }
                }

                return this.getFilesByIds(affectedFileIds)
            })(operations)

            return { success: true, data: { files: changed.data, tags: changedTags } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to update tags.'
            }
        }
    }

    public getFileOfId(id: number): Result<MediaFile> {
        try {
            const row = this.stmts.getFileById.get(id) as SQLiteMediaFileRaw | undefined

            if (!row) throw new Error(`Failed to get file: File of id=${id} might not exist`)

            const { tagsJson, ...fileData } = row
            return {
                success: true,
                data: {
                    ...fileData,
                    tags: JSON.parse(tagsJson)
                }
            }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get file.'
            }
        }
    }

    public getAllTags(): Result<Tag[]> {
        try {
            const stmt = this.db.prepare('SELECT id, name, color FROM tags ORDER BY name')
            const tags = stmt.all() as Tag[]
            return { success: true, data: tags }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get all tags.'
            }
        }
    }

    public insertFile(payload: UploadFilePayload) {
        const stmt = this.db.prepare(`
          INSERT INTO files (file_path, file_name, media_type)
          VALUES (?, ?, ?)
        `)
        return stmt.run(payload.filePath, payload.fileName, payload.mediaType)
    }

    public addTagToFile(fileId: number, tagId: number) {
        const stmt = this.db.prepare(`
          INSERT OR IGNORE INTO file_tags (file_id, tag_id)
          VALUES (?, ?)
        `)
        return stmt.run(fileId, tagId)
    }
}
