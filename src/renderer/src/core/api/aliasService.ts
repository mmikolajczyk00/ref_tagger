import { ActionResult } from './responses'

export async function getMap(): Promise<Map<string, Set<string>>> {
    const data = await window.api.get('alias')
    console.log('map', data)

    const map = new Map<string, Set<string>>()

    Object.entries(data).forEach(([k, v]) => {
        map.set(k, new Set<string>(v as string[]))
    })

    return map
}

export async function getTagByNameOrAlias(search: string): Promise<ActionResult> {
    const data = await window.api.post(`tags?alias=one`, search)

    return data
}

export async function getTagsByAliases(aliases: string[]): Promise<Map<string, Set<string>>> {
    console.log('alias many get', aliases)

    const data = await window.api.post(`tags?alias=many`, aliases)

    const map = new Map<string, Set<string>>()

    Object.entries(data).forEach(([k, v]) => {
        map.set(k, new Set<string>(v as string[]))
    })

    return map
}

export async function add(tag: string, aliases: string[]): Promise<ActionResult> {
    const data = await window.api.post(`tags/${tag}/alias`, aliases)
    console.log('data', data)

    return data
}

export async function remove(aliases: string[]): Promise<ActionResult> {
    const data = await window.api.delete('alias', { data: aliases })

    return data
}

export async function clearAllOfTag(tag: string): Promise<ActionResult> {
    const data = await window.api.delete(`tags/${tag}/alias?all=true`)

    return data
}

export async function clearAll(): Promise<ActionResult> {
    const data = await window.api.delete('alias?all=true')

    return data
}
