/*************************************************
 * Base class of the edit tree.
 *
 * The edit tree is a doubly-linked tree: every node knows its parent, its
 * left/right siblings and the two ends of its own child list. Only the
 * adopt/disown methods (implemented once, in Fragment) may change those
 * links, which keeps the tree well-formed.
 ************************************************/

import { L, R, type Direction, type Ends } from '../core/direction'
import { domFrag, type DOMFragment } from '../core/domFragment'
import type { Parser } from '../core/parser'
import type { Options } from '../options'
import type { Cursor } from './cursor'
import type { Controller } from '../controller/Controller'
import { Fragment, eachNode, foldNodes, type NodeRef } from './fragment'

/** Collects the `\MathQuillMathField` inner fields of a static math tree. */
export interface InnerFieldCollector {
    add(name: string | undefined, controller: Controller): void
}

export type UpDownTarget = MQNode | ((cursor: Cursor) => Cursor | undefined)

let idCounter = 0

/** An empty parent pointer. Detached nodes point at `0`; most code checks `if (node.parent)`. */
const NO_PARENT = 0 as unknown as MQNode

export class MQNode {
    readonly id = ++idCounter;

    [L]: NodeRef = 0;
    [R]: NodeRef = 0
    parent: MQNode = NO_PARENT

    /**
     * The (doubly-linked) list of this node's children. Subclasses may narrow
     * the type (e.g. commands always have blocks); `Fragment.disown` may break
     * such invariants temporarily until the next `adopt`.
     */
    ends: Ends<NodeRef> = { [L]: 0, [R]: 0 }

    /** LaTeX control sequence of this node (commands) or its character (symbols). */
    ctrlSeq: string | undefined
    /** Child blocks of a command, in order. */
    blocks: MQNode[] | undefined
    /** Blocks to jump into / out of when moving the cursor up or down. */
    upInto: MQNode | undefined
    downInto: MQNode | undefined
    upOutOf: UpDownTarget | undefined
    downOutOf: UpDownTarget | undefined
    /** Set on letters that are part of an auto-operator name like `sin`. */
    isPartOfOperator: boolean | undefined

    private el: Element | Text | undefined

    toString(): string {
        return '{{ MathQuill Node #' + this.id + ' }}'
    }

    // ---- structure -------------------------------------------------------

    setEnds(ends: Ends<NodeRef>): void {
        this.ends = ends
    }

    getEnd(dir: Direction): NodeRef {
        return this.ends[dir]
    }

    children(): Fragment {
        return new Fragment(this.getEnd(L), this.getEnd(R))
    }

    eachChild(cb: (child: MQNode) => boolean | void): this {
        eachNode(this.ends, cb)
        return this
    }

    foldChildren<T>(fold: T, cb: (fold: T, child: MQNode) => T): T {
        return foldNodes(this.ends, fold, cb)
    }

    isEmpty(): boolean {
        return this.ends[L] === 0 && this.ends[R] === 0
    }

    /** Call `cb` on this node and every ancestor, innermost first. Stops when `cb` returns false. */
    bubble(cb: (ancestor: MQNode) => boolean | void): this {
        for (let ancestor: MQNode = this; ancestor; ancestor = ancestor.parent) {
            if (cb(ancestor) === false) break
        }
        return this
    }

    /** Call `cb` on every descendant (children before parents), including this node. */
    postOrder(cb: (node: MQNode) => void): this {
        const recurse = (node: MQNode) => {
            node.eachChild(recurse)
            cb(node)
        }
        recurse(this)
        return this
    }

    /** Add this node between `leftward` and `rightward` among `parent`'s children. See `Fragment.adopt`. */
    adopt(parent: MQNode, leftward: NodeRef, rightward: NodeRef): this {
        new Fragment(this, this).adopt(parent, leftward, rightward)
        return this
    }

    withDirAdopt(dir: Direction, parent: MQNode, withDir: NodeRef, oppDir: NodeRef): this {
        new Fragment(this, this).withDirAdopt(dir, parent, withDir, oppDir)
        return this
    }

    disown(): this {
        new Fragment(this, this).disown()
        return this
    }

    remove(): this {
        this.domFrag().remove()
        return this.disown()
    }

    /**
     * Called before `createLeftOf` when this node is typed over a selection.
     * By default the selection is deleted; commands with blocks wrap it instead.
     */
    replaces(fragment: Fragment): void {
        fragment.remove()
    }

    // ---- DOM -------------------------------------------------------------

    setDOM(el: Element | Text | undefined): this {
        this.el = el
        return this
    }

    domFrag(): DOMFragment {
        return domFrag(this.el)
    }

    /** Render this node (and its subtree) to DOM. */
    html(): Node {
        throw new Error('html() is not implemented for ' + this.constructor.name)
    }

    /** Render and insert next to the cursor on side `dir`. */
    createDir(dir: Direction, cursor: Cursor): this {
        this.html()
        this.domFrag().insDirOf(dir, cursor.domFrag())
        cursor[dir] = this.adopt(cursor.parent, cursor[L], cursor[R])
        return this
    }

    createLeftOf(cursor: Cursor): void {
        this.createDir(L, cursor)
    }

    // ---- serialization ---------------------------------------------------

    text(): string {
        return ''
    }

    latex(): string {
        return ''
    }

    /** LaTeX parser for whatever follows this command's control sequence. */
    parser(): Parser<MQNode | Fragment> {
        throw new Error('parser() is not implemented for ' + this.constructor.name)
    }

    // ---- classification --------------------------------------------------

    isMathBlock(): boolean {
        return false
    }
    isSupSub(): boolean {
        return false
    }
    isStyleBlock(): boolean {
        return false
    }
    isTextBlock(): boolean {
        return false
    }

    /** True for an empty block whose delimiters were configured as `quietEmptyDelimiters`. */
    isQuietEmptyDelimiter(dlms: Record<string, unknown> | undefined): boolean {
        if (!this.isEmpty() || !dlms) return false
        if (!this.parent || this.parent.ctrlSeq === undefined) return false
        // strip a leading \left or \right before looking the delimiter up
        const key = this.parent.ctrlSeq.replace(/^\\(left|right)?/, '')
        return Object.prototype.hasOwnProperty.call(dlms, key)
    }

    shouldIgnoreSubstitutionInSimpleSubscript(options: Options): boolean {
        if (!options.disableAutoSubstitutionInSubscripts) return false
        if (!this.parent || !this.parent.parent) return false
        if (!this.parent.parent.isSupSub()) return false
        // The sub/supsub relationship is not always fully set up (e.g. during
        // paste), but the DOM class is, so that is what we check.
        return this.parent.domFrag().hasClass('mq-sub')
    }

    // ---- lifecycle hooks (overridden by subclasses) ----------------------

    /** Called once on every node of a freshly inserted subtree. */
    finalizeTree(_options: Options, _dir?: Direction): void {}
    /** Merge with like neighbours after insertion (e.g. adjacent SupSubs). */
    contactWeld(_cursor: Cursor, _dir?: Direction): void {}
    finalizeInsert(_options: Options, _cursor: Cursor): void {}
    siblingCreated(_options: Options, _dir: Direction): void {}
    siblingDeleted(_options: Options, _dir: Direction): void {}
    fixDigitGrouping(_options: Options): void {}
    /** Re-measure after the content changed (e.g. resize brackets). */
    reflow(): void {}
    focus(): void {}
    blur(_cursor?: Cursor): void {}
    /** Blur caused by the user leaving the field (as opposed to window blur). */
    intentionalBlur(): void {}
    registerInnerField(_collector: InnerFieldCollector): void {}

    // ---- editing hooks, called with the cursor ---------------------------

    /** Create the node to insert when `ch` is typed inside this block. */
    chToCmd(_ch: string, _options: Options): MQNode {
        throw new Error('chToCmd() is not implemented for ' + this.constructor.name)
    }
    write(_cursor: Cursor, _ch: string): void {}
    writeLatex(_cursor: Cursor, _latex: string): void {}
    /**
     * Give the block containing the cursor a chance to handle a keystroke
     * before the default key map. Return true if handled.
     */
    handleKeystroke(_key: string, _e: KeyboardEvent | undefined, _ctrlr: Controller): boolean {
        return false
    }
    /** Place the cursor in this node at the x-coordinate `clientX`. */
    seek(_clientX: number, _cursor: Cursor): void {}

    moveOutOf(_dir: Direction, _cursor: Cursor, _updown?: 'up' | 'down'): void {}
    moveTowards(_dir: Direction, _cursor: Cursor, _updown?: 'up' | 'down'): void {}
    deleteOutOf(_dir: Direction, _cursor: Cursor): void {}
    deleteTowards(_dir: Direction, _cursor: Cursor): void {}
    unselectInto(_dir: Direction, _cursor: Cursor): void {}
    selectOutOf(_dir: Direction, _cursor: Cursor): void {}
    selectTowards(_dir: Direction, _cursor: Cursor): void {}
}

/** Constructor of a tree node class (used by the command registry). */
export type NodeClass = abstract new (...args: never[]) => MQNode

export function isNodeClass(value: unknown): value is new (name: string) => MQNode {
    return typeof value === 'function' && value.prototype instanceof MQNode
}
