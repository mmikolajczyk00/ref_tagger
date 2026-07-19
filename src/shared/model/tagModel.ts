import { UUID } from 'crypto'
import { kMaxLength } from 'buffer'
import { Selectable } from '../../renderer/src/core/utils/selectionHandler'

export class GroupTagMap {
  map: Map<string, Set<string>> = new Map()

  addTagsToGroup(names: string[], group: string) {
    let groupTags = this.map.get(group) || new Set()
    this.map.set(group, groupTags.union(new Set(names)))
  }
  addTags(arr: { name: string; group: string }[]) {
    arr.forEach((t) => {
      this.addTag(t.name, t.group)
    })
  }
  addTag(name: string, group: string) {
    let groupTags = this.map.get(group) || new Set()
    this.map.set(group, groupTags.add(name))
  }
  removeTag(name: string) {
    let keys = [...this.map.keys()]
    for (let i = 0; i < keys.length; i++) {
      const set = this.map.get(keys[i])
      if (set?.has(name)) {
        set.delete(name)
        break
      }
    }
  }
  removeTags(names: string[]) {
    let toDelete = new Set(names)
    let keys = [...this.map.keys()]
    for (let i = 0; i < keys.length; i++) {
      const set = this.map.get(keys[i])

      for (let j = 0; j < names.length; j++) {
        const name = names[j]
        if (set?.has(name)) {
          set.delete(name)
          toDelete.delete(name)
        }
        if (toDelete.size == 0) return
      }
    }
  }
  removeTagFromGroup(name: string, group: string) {
    const set = this.map.get(group)
    if (set?.has(name)) {
      set.delete(name)
    }
  }
  getTagsOfGroup(group: string): Set<string> | undefined {
    return this.map.get(group)
  }
  getAllTags(): Set<string> {
    let set = new Set<string>()
    this.map.forEach((v) => {
      set = set.union(v)
    })
    return set
  }
  getGroups(): Set<string> {
    return new Set([...this.map.keys()].filter((g) => this.map.get(g)!.size > 0))
  }
  assign(other: GroupTagMap) {
    other.map.forEach((v, k) => {
      let groupTags = this.map.get(k) || new Set()
      // this.map.set(k, groupTags.union(new Set(v)))
      this.map.set(k, new Set([...groupTags.keys(), ...v.keys()]))
    })
  }
  editTag(oldTagName, oldGroupName, newName, newGroup) {
    this.removeTagFromGroup(oldTagName, oldGroupName)
    this.addTag(newName, newGroup)
  }
}

export class TagModel {
  id: UUID
  name: string
  group_name: string
  parents: Set<TagSimpleResponse>
  children: Set<TagSimpleResponse>

  constructor(
    id: UUID,
    name: string,
    group_name?: string,
    parents?: Set<TagSimpleResponse>,
    children?: Set<TagSimpleResponse>
  ) {
    this.id = id
    this.name = name
    this.group_name = group_name || 'general'
    this.parents = parents || new Set()
    this.children = children || new Set()
  }

  static fromDto(dto: TagResponse): TagModel {
    return new TagModel(dto.id, dto.name, dto.group_name, dto.parents, dto.children)
  }
}

export class TagRequest {
  name: string
  group_name: string
  parents: {
    tags: string[]
  }
  children: {
    tags: string[]
  }

  constructor(name: string, group_name?: string, parents?: string[], children?: string[]) {
    this.name = name
    this.group_name = group_name || 'general'
    this.parents = {
      tags: parents || []
    }
    this.children = {
      tags: children || []
    }
  }

  static fromModel(model: TagModel): TagRequest {
    let parents = [] as string[]
    let children = [] as string[]

    model.parents.forEach((p) => {
      parents.push(p.name)
    })
    model.children.forEach((c) => {
      children.push(c.name)
    })

    return new TagRequest(model.name, model.group_name, parents, children)
  }
}

export interface TagResponse {
  id: UUID
  name: string
  group_name: string
  parents: Set<TagSimpleResponse>
  children: Set<TagSimpleResponse>
}

export interface TagSimpleResponse {
  id: UUID
  name: string
}

export class TagGroup implements Selectable {
  selected: boolean = false
  name: string = 'general'

  constructor(name: string) {
    this.name = name
  }
}
