import { L, R, type Direction, type Ends } from '../core/direction'
import { domFrag, type DOMFragment } from '../core/domFragment'
import type { MQNode } from './node'

/** A sibling link: a node, or 0 at the beginning/end of a child list. */
export type NodeRef = MQNode | 0

/**
 * Iterate the sibling run `ends[L]..ends[R]`. Stops early when `cb` returns false.
 * The run must be well-formed: iterating past the end of the list throws.
 */
export function eachNode(ends: Ends<NodeRef>, cb: (node: MQNode) => boolean | void): void {
    const first = ends[L]
    const last = ends[R]
    if (!first || !last) return
    const stop = last[R]
    for (let node: NodeRef = first; node !== stop; node = (node as MQNode)[R]) {
        if (cb(node as MQNode) === false) break
    }
}

export function foldNodes<T>(ends: Ends<NodeRef>, fold: T, cb: (fold: T, node: MQNode) => T): T {
    eachNode(ends, (node) => {
        fold = cb(fold, node)
    })
    return fold
}

/**
 * A view of a contiguous run of sibling nodes, delimited by its two ends.
 *
 * Like a DOM DocumentFragment its contents must be siblings, but like a DOM
 * Range it only has one-way pointers to its contents: the nodes don't know
 * about the fragment and may still be in the tree.
 */
export class Fragment {
    ends: Ends<NodeRef> = { [L]: 0, [R]: 0 }
    disowned = false

    /** `withDir` is the end in direction `dir` (default L), `oppDir` the other end. */
    constructor(withDir: NodeRef, oppDir: NodeRef, dir: Direction = L) {
        if (!withDir || !oppDir) return
        this.setEnds({ [dir]: withDir, [-dir]: oppDir } as Ends<NodeRef>)
    }

    /** Subclasses may override to enforce invariants on the ends. */
    setEnds(ends: Ends<NodeRef>): void {
        this.ends = ends
    }

    getEnd(dir: Direction): NodeRef {
        return this.ends[dir]
    }

    isEmpty(): boolean {
        return !this.ends[L]
    }

    getDOMFragFromEnds(): DOMFragment {
        const left = this.ends[L]
        const right = this.ends[R]
        if (left === 0 || right === 0) return domFrag()
        // joining a DOMFragment to itself is not allowed
        if (left === right) return left.domFrag()
        return left.domFrag().join(right.domFrag())
    }

    domFrag(): DOMFragment {
        return this.getDOMFragFromEnds()
    }

    /** Like `Cursor.withDirInsertAt(dir, parent, withDir, oppDir)`. */
    withDirAdopt(dir: Direction, parent: MQNode, withDir: NodeRef, oppDir: NodeRef): this {
        return dir === L ? this.adopt(parent, withDir, oppDir) : this.adopt(parent, oppDir, withDir)
    }

    /**
     * Splice this fragment into `parent`'s children between `leftward`
     * (0 = at the beginning) and `rightward` (0 = at the end).
     */
    adopt(parent: MQNode, leftward: NodeRef, rightward: NodeRef): this {
        this.disowned = false
        const leftEnd = this.ends[L]
        const rightEnd = this.ends[R]
        if (!leftEnd || !rightEnd) return this

        const ends = { [L]: parent.getEnd(L), [R]: parent.getEnd(R) }
        if (!leftward) ends[L] = leftEnd
        if (rightward) rightward[L] = rightEnd
        else ends[R] = rightEnd
        parent.setEnds(ends)

        rightEnd[R] = rightward
        let prev = leftward
        this.each((node) => {
            node[L] = prev
            node.parent = parent
            if (prev) prev[R] = node
            prev = node
        })
        return this
    }

    /** Remove the nodes of this fragment from their parent (the nodes keep their own pointers). */
    disown(): this {
        const leftEnd = this.ends[L]
        // guard for empty and already-disowned fragments
        if (!leftEnd || this.disowned) return this
        this.disowned = true

        const rightEnd = this.ends[R]
        if (!rightEnd) return this
        const parent = leftEnd.parent

        const ends = { [L]: parent.getEnd(L), [R]: parent.getEnd(R) }
        const before = leftEnd[L]
        const after = rightEnd[R]
        if (before) before[R] = after
        else ends[L] = after
        if (after) after[L] = before
        else ends[R] = before

        if (ends[L] && ends[R]) {
            parent.setEnds(ends)
        } else {
            // Some node classes narrow `ends` to be non-empty and enforce it in
            // setEnds; disown may break that temporarily (a following adopt is
            // expected to restore it), so bypass setEnds here.
            parent.ends = ends
        }
        return this
    }

    remove(): this {
        this.domFrag().remove()
        return this.disown()
    }

    each(cb: (node: MQNode) => boolean | void): this {
        eachNode(this.ends, cb)
        return this
    }

    fold<T>(fold: T, cb: (fold: T, node: MQNode) => T): T {
        return foldNodes(this.ends, fold, cb)
    }
}
