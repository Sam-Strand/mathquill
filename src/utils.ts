import type { Direction } from './types'

export const min = Math.min
export const max = Math.max

export function noop() { }

/**
 * a development-only debug method.  This definition and all
 * calls to `pray` will be stripped from the minified
 * build of mathquill.
 *
 * This function must be called by name to be removed
 * at compile time.  Do not define another function
 * with the same name, and only call this function by
 * name.
 */
export function pray(message: string, cond?: any): asserts cond {
    if (!cond) throw new Error('prayer failed: ' + message)
}

export function prayDirection(dir: Direction) {
    pray('a direction was passed', dir === -1 || dir === 1)
}
