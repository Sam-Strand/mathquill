/********************************************
 * Point, Cursor and the anticursor used for selections.
 *
 * The Cursor is the single thing that moves through the edit tree. Every
 * movement updates the tree position and the HTML DOM together.
 *******************************************/
import { L, R, opp, type Direction } from '../core/direction'
import { U_ZERO_WIDTH_SPACE } from '../core/unicode'
import { domFrag, type DOMFragment } from '../core/domFragment'
import { h } from '../core/dom'
import { getBoundingClientRect } from '../core/geometry'
import type { Options } from '../options'
import type { Controller } from '../controller/Controller'
import type { NodeRef } from './fragment'
import type { MQNode } from './node'
import { MQSelection } from './selection'

/** A cursor-like location in the tree: between `[L]` and `[R]` inside `parent`. */
export class Point {
    /** Node to the left (0 at the beginning of the block) */
    [L]: NodeRef;
    /** Node to the right (0 at the end of the block) */
    [R]: NodeRef
    parent: MQNode

    constructor(parent: MQNode, leftward: NodeRef, rightward: NodeRef) {
        this.parent = parent
        this[L] = leftward
        this[R] = rightward
    }

    static copy(pt: Point): Point {
        return new Point(pt.parent, pt[L], pt[R])
    }
}

/** The fixed end of a selection; remembers its ancestors to find the common ancestor quickly. */
export class Anticursor extends Point {
    readonly ancestors: Record<number, Anticursor | MQNode | undefined> = {}

    static fromCursor(cursor: Cursor): Anticursor {
        return new Anticursor(cursor.parent, cursor[L], cursor[R])
    }
}

export class Cursor extends Point {
    /**
     * Remembers the cursor position in each block, so that moving up and
     * down among blocks returns to the same place.
     */
    upDownCache: Record<number, Point | undefined> = {}
    /** Toggles the blink class; replaced by a no-op while mouse-selecting. */
    blink: () => void
    readonly cursorElement: HTMLElement = h('span', { class: 'mq-cursor' }, [h.text(U_ZERO_WIDTH_SPACE)])
    selection: MQSelection | undefined
    anticursor: Anticursor | undefined
    private frag: DOMFragment = domFrag()
    private intervalId = 0

    constructor(
        initParent: MQNode,
        readonly options: Options,
        readonly controller: Controller
    ) {
        super(initParent, 0, 0)
        this.frag = domFrag(this.cursorElement)
        this.blink = () => {
            domFrag(this.cursorElement).toggleClass('mq-blink')
        }
    }

    domFrag(): DOMFragment {
        return this.frag
    }

    isVisible(): boolean {
        return this.intervalId !== 0
    }

    show(): this {
        domFrag(this.cursorElement).removeClass('mq-blink')
        this.frag = domFrag(this.cursorElement)
        if (this.intervalId) {
            // already shown, just restart the blink interval
            clearInterval(this.intervalId)
        } else {
            // was hidden and detached: put the cursor element back into the DOM
            const right = this[R]
            if (right) {
                const selection = this.selection
                if (selection && selection.getEnd(L)[L] === this[L]) this.frag.insertBefore(selection.domFrag())
                else this.frag.insertBefore(right.domFrag())
            } else {
                this.frag.appendTo(this.parent.domFrag().oneElement())
            }
            this.parent.focus()
        }
        this.intervalId = window.setInterval(this.blink, 500)
        return this
    }

    hide(): this {
        if (this.intervalId) clearInterval(this.intervalId)
        this.intervalId = 0
        this.frag.detach()
        this.frag = domFrag()
        return this
    }

    withDirInsertAt(dir: Direction, parent: MQNode, withDir: NodeRef, oppDir: NodeRef): void {
        const oldParent = this.parent
        this.parent = parent
        this[dir] = withDir
        this[opp(dir)] = oppDir
        // by contract, blur() is called after the cursor has actually moved
        if (oldParent !== parent) oldParent.blur(this)
    }

    /** Place the cursor next to `el`, on side `dir`. */
    insDirOf(dir: Direction, el: MQNode): this {
        this.frag.insDirOf(dir, el.domFrag())
        this.withDirInsertAt(dir, el.parent, el[dir], el)
        this.parent.domFrag().addClass('mq-hasCursor')
        return this
    }
    insLeftOf(el: MQNode): this {
        return this.insDirOf(L, el)
    }
    insRightOf(el: MQNode): this {
        return this.insDirOf(R, el)
    }

    /** Place the cursor inside `el`, at its left or right end. */
    insAtDirEnd(dir: Direction, el: MQNode): this {
        this.frag.insAtDirEnd(dir, el.domFrag().oneElement())
        this.withDirInsertAt(dir, el, 0, el.getEnd(dir))
        el.focus()
        return this
    }
    insAtLeftEnd(el: MQNode): this {
        return this.insAtDirEnd(L, el)
    }
    insAtRightEnd(el: MQNode): this {
        return this.insAtDirEnd(R, el)
    }

    /**
     * Jump up or down from one block to another: remember the position in
     * `from`, then restore the remembered position in `to`, or else seek to
     * the horizontally closest position.
     */
    jumpUpDown(from: MQNode, to: MQNode): void {
        this.upDownCache[from.id] = Point.copy(this)
        const cached = this.upDownCache[to.id]
        if (cached) {
            const cachedR = cached[R]
            if (cachedR) this.insLeftOf(cachedR)
            else this.insAtRightEnd(cached.parent)
        } else {
            to.seek(this.getBoundingClientRectWithoutMargin().left, this)
        }
    }

    /** The cursor has a negative margin; measure it without. */
    getBoundingClientRectWithoutMargin(): { left: number; right: number } {
        const frag = this.frag
        frag.removeClass('mq-cursor')
        const { left, right } = getBoundingClientRect(frag.oneElement())
        frag.addClass('mq-cursor')
        return { left, right }
    }

    /** Replace the grandparent command by the contents of its blocks (used when deleting out of a block). */
    unwrapGramp(): void {
        const gramp = this.parent.parent
        const greatgramp = gramp.parent
        const rightward = gramp[R]

        let leftward = gramp[L]
        gramp.disown().eachChild((uncle) => {
            if (uncle.isEmpty()) return
            uncle
                .children()
                .adopt(greatgramp, leftward, rightward)
                .each((cousin) => {
                    cousin.domFrag().insertBefore(gramp.domFrag())
                })
            leftward = uncle.getEnd(R)
        })

        if (!this[R]) {
            // find something to be rightward of, to insLeftOf
            const thisL = this[L]
            if (thisL) {
                this[R] = thisL[R]
            } else {
                while (!this[R]) {
                    const newParent = this.parent[R]
                    if (newParent) {
                        this.parent = newParent
                        this[R] = newParent.getEnd(L)
                    } else {
                        this[R] = gramp[R]
                        this.parent = greatgramp
                        break
                    }
                }
            }
        }

        const thisR = this[R]
        if (thisR) this.insLeftOf(thisR)
        else this.insAtRightEnd(greatgramp)

        gramp.domFrag().remove()

        const grampL = gramp[L]
        const grampR = gramp[R]
        if (grampL) grampL.siblingDeleted(this.options, R)
        if (grampR) grampR.siblingDeleted(this.options, L)
    }

    // ---- selection -------------------------------------------------------

    startSelection(): void {
        const anticursor = (this.anticursor = Anticursor.fromCursor(this))
        const ancestors = anticursor.ancestors
        for (let ancestor: MQNode | Anticursor = anticursor; ancestor.parent; ancestor = ancestor.parent) {
            ancestors[ancestor.parent.id] = ancestor
        }
    }

    endSelection(): void {
        this.anticursor = undefined
    }

    /** Select everything between the anticursor and the cursor. Returns false if they coincide. */
    select(): boolean {
        const anticursor = this.anticursor
        if (!anticursor) return false
        if (this[L] === anticursor[L] && this.parent === anticursor.parent) return false

        // Find the lowest common ancestor (`lca`) and the ancestor of the
        // cursor whose parent is the LCA (one end of the selection).
        let lca: MQNode | undefined
        let ancestor: MQNode | Point = this
        for (; ancestor.parent; ancestor = ancestor.parent) {
            if (ancestor.parent.id in anticursor.ancestors) {
                lca = ancestor.parent
                break
            }
        }
        if (!lca) return false

        // The other end: the ancestor of the anticursor whose parent is the LCA.
        const antiAncestor = anticursor.ancestors[lca.id] as MQNode | Point

        // Now we have two Nodes or Points with a common parent (not both the
        // same Point); figure out which is the left end. As a special case,
        // `ancestor` may be a Point with `antiAncestor` a Node immediately to
        // its left. Otherwise `antiAncestor[R] === rightward[R]` for some
        // `rightward` at or right of `ancestor` iff antiAncestor is to the right.
        let leftEnd: MQNode | Point = antiAncestor
        let rightEnd: MQNode | Point = ancestor
        let dir: Direction = R
        if (ancestor[L] !== antiAncestor) {
            for (let rightward: NodeRef | Point = ancestor; rightward; rightward = rightward[R]) {
                if (rightward[R] === antiAncestor[R]) {
                    dir = L
                    leftEnd = ancestor
                    rightEnd = antiAncestor
                    break
                }
            }
        }

        // only Nodes can be selected, not Points
        const left = (leftEnd instanceof Point ? leftEnd[R] : leftEnd) as MQNode
        const right = (rightEnd instanceof Point ? rightEnd[L] : rightEnd) as MQNode

        this.hide()
        const selection = (this.selection = new MQSelection(left, right))
        this.insDirOf(dir, selection.getEnd(dir))
        this.controller.onSelectionChanged()
        return true
    }

    /** Clear any selection and put the cursor at the right end of `root`. */
    resetToEnd(root: MQNode): void {
        this.clearSelection()
        this[R] = 0
        this[L] = root.getEnd(R)
        this.parent = root
    }

    clearSelection(): this {
        if (this.selection) {
            this.selection.clear()
            this.selection = undefined
            this.controller.onSelectionChanged()
        }
        return this
    }

    deleteSelection(): void {
        const selection = this.selection
        if (!selection) return
        this[L] = selection.getEnd(L)[L]
        this[R] = selection.getEnd(R)[R]
        selection.remove()
        this.selection = undefined
        this.controller.onSelectionChanged()
    }

    /** Take the selection out of the tree (DOM left alone), so a new command can wrap it. */
    replaceSelection(): MQSelection | undefined {
        const seln = this.selection
        if (seln) {
            this[L] = seln.getEnd(L)[L]
            this[R] = seln.getEnd(R)[R]
            this.selection = undefined
        }
        return seln
    }

    /** Number of math blocks between the cursor and the root. */
    depth(): number {
        let depth = 0
        for (let node: MQNode = this.parent; node; node = node.parent) {
            if (node.isMathBlock()) depth += 1
        }
        return depth
    }

    isTooDeep(offset = 0): boolean {
        const max = this.options.maxDepth
        return max !== undefined && this.depth() + offset > max
    }
}
