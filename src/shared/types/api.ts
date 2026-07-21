export type Result<T = void, E = string> = { success: true; data: T } | { success: false; error: E }
