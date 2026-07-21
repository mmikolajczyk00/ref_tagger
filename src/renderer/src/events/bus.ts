// src/renderer/events/bus.ts
import { MediaFile } from '@/shared/types/models'
import mitt from 'mitt'

type ApplicationEvents = {
    'files:updated': { ids: Set<number>; files: Map<number, MediaFile> }
}

export const eventBus = mitt<ApplicationEvents>()
