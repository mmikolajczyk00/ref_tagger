import path from 'path'
import Database from 'better-sqlite3'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { CanvasService } from './CanvasService'
import { FileService } from './FileService'
import { FileStorageService } from './FileStorageService'
import { SearchService } from './SearchService'
import { TagService } from './TagService'
import { TagsProcessingService } from './TagsProcessingService'

const initDDL = `
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        source_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_tags (
        file_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (file_id, tag_id),
        FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_files_media_type ON files(media_type);

    CREATE TABLE IF NOT EXISTS tag_relations (
        parent_id INTEGER NOT NULL,
        child_id INTEGER NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (parent_id, child_id),
        FOREIGN KEY (parent_id) REFERENCES tags (id) ON DELETE CASCADE,
        FOREIGN KEY (child_id) REFERENCES tags (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tag_relations_parent ON tag_relations(parent_id);
    CREATE INDEX IF NOT EXISTS idx_tag_relations_child ON tag_relations(child_id);

    CREATE TABLE IF NOT EXISTS canvases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        data_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blacklists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blacklist_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        FOREIGN KEY (list_id) REFERENCES blacklists (id) ON DELETE CASCADE,
        UNIQUE (list_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_blacklist_tags_list ON blacklist_tags(list_id);

    CREATE TABLE IF NOT EXISTS aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        real_tag TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alias_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alias_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        FOREIGN KEY (alias_id) REFERENCES aliases (id) ON DELETE CASCADE,
        UNIQUE (alias_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_alias_tags_alias ON alias_tags(alias_id);
`

export class LocalDatabaseService {
    private prisma: PrismaClient
    public readonly canvasService: CanvasService
    public readonly fileStorage: FileStorageService
    public readonly fileService: FileService
    public readonly tagService: TagService
    public readonly searchService: SearchService
    public readonly tagsProcessingService: TagsProcessingService

    constructor(dbFolderPath: string, fileRootDir: string) {
        const dbPath = path.join(dbFolderPath, 'ref-sheeter.sqlite')

        const initDb = new Database(dbPath)
        initDb.pragma('journal_mode = WAL')
        initDb.pragma('foreign_keys = ON')
        initDb.exec(initDDL)

        try {
            initDb.exec('ALTER TABLE files ADD COLUMN source_url TEXT')
        } catch {
            // column already exists on existing databases — safe to ignore
        }

        initDb.close()

        const adapterFactory = new PrismaBetterSqlite3({ url: dbPath })
        this.prisma = new PrismaClient({ adapter: adapterFactory })

        this.canvasService = new CanvasService(this.prisma, path.join(dbFolderPath, 'canvases'))
        this.fileStorage = new FileStorageService(fileRootDir)
        this.fileStorage
            .clearTempThumbs()
            .catch((e) => console.warn('Temp thumb cleanup failed:', e))
        this.fileService = new FileService(this.prisma, this.fileStorage)
        this.tagService = new TagService(this.prisma)
        this.searchService = new SearchService(this.prisma, this.fileService)
        this.tagsProcessingService = new TagsProcessingService(this.prisma)
    }
}
