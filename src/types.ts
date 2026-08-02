export const L = -1 as const
export const R = 1 as const
export type Direction = typeof L | typeof R

export type Ends<T> = {
    readonly [L]: T
    readonly [R]: T
}
