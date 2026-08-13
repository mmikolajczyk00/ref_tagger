import type { InjectionKey } from 'vue'
import type { Tag } from '@shared/types/models'

export interface TagRelations {
    childrenByTag: Record<number, number[]>
    parentsByTag: Record<number, number[]>
}

export interface TagEditorRelationsApi {
    getParents: (childId: number) => Tag[]
    getChildren: (parentId: number) => Tag[]
    addParentByName: (childId: number, names: string[]) => Promise<void>
    addChildByName: (parentId: number, names: string[]) => Promise<void>
    removeParent: (childId: number, parentId: number) => Promise<void>
    removeChild: (parentId: number, childId: number) => Promise<void>
    updateTagName: (id: number, name: string) => Promise<void>
}

export const tagEditorRelationsKey: InjectionKey<TagEditorRelationsApi> =
    Symbol('tagEditorRelations')
