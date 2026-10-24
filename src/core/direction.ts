/** Horizontal directions inside the edit tree. Encoded as ±1 so that `-dir` flips them. */
export const L = -1 as const
export const R = 1 as const
export type Direction = typeof L | typeof R

/** A pair of values keyed by direction (left end / right end). */
export type Ends<T> = { [L]: T; [R]: T }

/** The opposite direction. */
export function opp(dir: Direction): Direction {
    return -dir as Direction
}
