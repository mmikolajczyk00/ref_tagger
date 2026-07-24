import { ActionResult } from 'puppeteer-core'

export async function getAll(): Promise<Set<string>> {
    const data = await window.api.get('blacklist')

    return new Set<string>(data)
}

export async function add(newArr: string[]): Promise<ActionResult> {
    console.log(newArr)

    const data = await window.api.post('blacklist', newArr)

    return data
}

export async function remove(arr: string[]): Promise<ActionResult> {
    const data = await window.api.delete('blacklist', { data: arr })

    return data
}

export async function clearAll(): Promise<ActionResult> {
    const data = await window.api.delete('blacklist?all=true')

    return data
}
