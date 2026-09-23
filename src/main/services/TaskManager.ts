import { BrowserWindow } from 'electron'
import { TaskInfo } from '../../shared/types/models'

interface TaskRecord {
    info: TaskInfo
    win: BrowserWindow
}

export class TaskManager {
    private tasks = new Map<string, TaskRecord>()

    createTask(label: string, win: BrowserWindow): string {
        const id = crypto.randomUUID()
        const info: TaskInfo = { id, label, percentage: 0, status: 'running' }
        this.tasks.set(id, { info, win })
        this.send(win, info)
        return id
    }

    updateProgress(id: string, percentage: number): void {
        const record = this.tasks.get(id)
        if (!record) return
        record.info.percentage = percentage
        this.send(record.win, record.info)
    }

    completeTask(id: string, warning?: string): void {
        const record = this.tasks.get(id)
        if (!record) return
        record.info.status = 'done'
        record.info.percentage = 100
        if (warning) record.info.warning = warning
        this.send(record.win, record.info)
    }

    failTask(id: string, error: string): void {
        const record = this.tasks.get(id)
        if (!record) return
        record.info.status = 'error'
        record.info.error = error
        this.send(record.win, record.info)
    }

    hasActiveTasks(): boolean {
        return [...this.tasks.values()].some((r) => r.info.status === 'running')
    }

    getTasks(): TaskInfo[] {
        return [...this.tasks.values()].map((r) => r.info)
    }

    private send(win: BrowserWindow | undefined, info: TaskInfo): void {
        if (win && !win.isDestroyed()) {
            win.webContents.send('api:tasks:updated', info)
        }
    }
}
