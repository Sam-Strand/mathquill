import { L, R, type Direction, type Ends } from './direction'

/**
 * A contiguous run of sibling DOM nodes (possibly empty), described by its
 * first and last node. This is the jQuery replacement used by the renderer:
 * it never owns the nodes, it is just a view of a sibling range.
 *
 * Invariant: when non-empty, `ends[R]` is reachable from `ends[L]` by
 * following `nextSibling`.
 */
export class DOMFragment {
    private readonly ends: Ends<Node> | undefined

    constructor(first?: Node, last: Node | undefined = first) {
        this.ends = first && last ? { [L]: first, [R]: last } : undefined
    }

    isEmpty(): boolean {
        return this.ends === undefined
    }

    isOneNode(): boolean {
        return !!this.ends && this.ends[L] === this.ends[R]
    }

    /** True if `ends[R]` is reachable from `ends[L]` (always true for empty fragments). */
    isValid(): boolean {
        if (!this.ends || this.ends[L] === this.ends[R]) return true
        let last: Node | undefined
        this.eachNode((node) => (last = node))
        return last === this.ends[R]
    }

    private requireEnds(): Ends<Node> {
        if (!this.ends) throw new Error('DOMFragment is empty')
        return this.ends
    }

    firstNode(): Node {
        return this.requireEnds()[L]
    }

    lastNode(): Node {
        return this.requireEnds()[R]
    }

    /** The single node of a one-node fragment. */
    oneNode(): Node {
        const ends = this.requireEnds()
        if (ends[L] !== ends[R]) throw new Error('DOMFragment has more than one node')
        return ends[L]
    }

    oneElement(): HTMLElement {
        return this.oneNode() as HTMLElement
    }

    oneText(): Text {
        return this.oneNode() as Text
    }

    /** All child nodes (including text nodes) of the single node of this fragment. */
    children(): DOMFragment {
        const el = this.oneNode()
        return new DOMFragment(el.firstChild ?? undefined, el.lastChild ?? undefined)
    }

    /** Concatenate with a fragment that starts somewhere after this one ends. */
    join(sibling: DOMFragment): DOMFragment {
        if (!this.ends) return sibling
        if (!sibling.ends) return this
        return new DOMFragment(this.ends[L], sibling.ends[R])
    }

    /**
     * Iterate over all nodes. `next` is cached before calling `cb`, so the
     * callback may move the current node elsewhere (e.g. into a document
     * fragment) without breaking iteration.
     */
    eachNode(cb: (node: Node) => void): this {
        if (!this.ends) return this
        const stop = this.ends[R]
        for (let node: Node | null = this.ends[L]; node; ) {
            const next: Node | null = node.nextSibling
            cb(node)
            if (node === stop) break
            node = next
        }
        return this
    }

    eachElement(cb: (el: HTMLElement) => void): this {
        return this.eachNode((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) cb(node as HTMLElement)
        })
    }

    text(): string {
        let accum = ''
        this.eachNode((node) => (accum += node.textContent || ''))
        return accum
    }

    toNodeArray(): Node[] {
        const accum: Node[] = []
        this.eachNode((node) => accum.push(node))
        return accum
    }

    toElementArray(): HTMLElement[] {
        const accum: HTMLElement[] = []
        this.eachElement((el) => accum.push(el))
        return accum
    }

    /** Move all nodes into a new DocumentFragment (detaching them, but keeping their mutual sibling links). */
    toDocumentFragment(): DocumentFragment {
        const frag = document.createDocumentFragment()
        this.eachNode((node) => frag.appendChild(node))
        return frag
    }

    insertBefore(sibling: DOMFragment): this {
        return this.insDirOf(L, sibling)
    }

    insertAfter(sibling: DOMFragment): this {
        return this.insDirOf(R, sibling)
    }

    append(children: DOMFragment): this {
        children.appendTo(this.oneElement())
        return this
    }

    prepend(children: DOMFragment): this {
        children.prependTo(this.oneElement())
        return this
    }

    appendTo(el: ParentNode): this {
        return this.insAtDirEnd(R, el)
    }

    prependTo(el: ParentNode): this {
        return this.insAtDirEnd(L, el)
    }

    parent(): DOMFragment {
        if (!this.ends) return this
        return new DOMFragment(this.ends[L].parentNode ?? undefined)
    }

    /** Wrap all nodes in `el` (which is emptied first), putting `el` where the nodes were. */
    wrapAll(el: HTMLElement): this {
        el.textContent = ''
        if (!this.ends) return this
        const parent = this.ends[L].parentNode
        const next = this.ends[R].nextSibling
        this.appendTo(el)
        parent?.insertBefore(el, next)
        return this
    }

    /**
     * Replace this fragment with `children`. The children are detached even
     * when they cannot be re-inserted (empty fragment / no parent).
     */
    replaceWith(children: DOMFragment): this {
        const rightEnd = this.ends?.[R]
        // cache before detaching, which mutates parent and sibling references
        const parent = rightEnd?.parentNode
        const nextSibling = rightEnd?.nextSibling ?? null
        this.detach()
        const replacement = children.toDocumentFragment()
        if (parent) parent.insertBefore(replacement, nextSibling)
        return this
    }

    /** The n-th element (text nodes are skipped). */
    nthElement(n: number): HTMLElement | undefined {
        if (!this.ends || n < 0 || n !== Math.floor(n)) return undefined
        for (let node: Node | null = this.ends[L]; node; node = node.nextSibling) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (n <= 0) return node as HTMLElement
                n -= 1
            }
            if (node === this.ends[R]) return undefined
        }
        return undefined
    }

    firstElement(): HTMLElement | undefined {
        return this.nthElement(0)
    }

    lastElement(): HTMLElement | undefined {
        if (!this.ends) return undefined
        for (let node: Node | null = this.ends[R]; node; node = node.previousSibling) {
            if (node.nodeType === Node.ELEMENT_NODE) return node as HTMLElement
            if (node === this.ends[L]) return undefined
        }
        return undefined
    }

    first(): DOMFragment {
        return new DOMFragment(this.firstElement())
    }

    last(): DOMFragment {
        return new DOMFragment(this.lastElement())
    }

    eq(n: number): DOMFragment {
        return new DOMFragment(this.nthElement(n))
    }

    /** Fragment from the n-th element to the end. */
    slice(n: number): DOMFragment {
        if (!this.ends) return this
        const el = this.nthElement(n)
        return el ? new DOMFragment(el, this.ends[R]) : new DOMFragment()
    }

    /** Next element sibling of the single node of this fragment. */
    next(): DOMFragment {
        return new DOMFragment(adjacentElement(this.oneNode(), R))
    }

    /** Previous element sibling of the single node of this fragment. */
    prev(): DOMFragment {
        return new DOMFragment(adjacentElement(this.oneNode(), L))
    }

    /** Remove the contents of every element of this fragment. */
    empty(): this {
        return this.eachElement((el) => (el.textContent = ''))
    }

    /**
     * Detach from the document. The nodes are moved to a document fragment so
     * their mutual sibling references stay intact and they can be reattached.
     */
    remove(): this {
        this.toDocumentFragment()
        return this
    }

    detach(): this {
        return this.remove()
    }

    /** Insert this fragment next to `sibling` on side `dir`. Detaches if `sibling` is not in the DOM. */
    insDirOf(dir: Direction, sibling: DOMFragment): this {
        if (!this.ends) return this
        const target = sibling.ends?.[dir]
        if (!target || !target.parentNode) return this.detach()
        target.parentNode.insertBefore(this.toDocumentFragment(), dir === L ? target : target.nextSibling)
        return this
    }

    /** Insert this fragment as the first (L) or last (R) children of `parent`. */
    insAtDirEnd(dir: Direction, parent: ParentNode): this {
        if (!this.ends) return this
        const source = this.toDocumentFragment()
        if (dir === L) parent.insertBefore(source, parent.firstChild)
        else parent.appendChild(source)
        return this
    }

    hasClass(className: string): boolean {
        let out = false
        this.eachElement((el) => {
            if (el.classList.contains(className)) out = true
        })
        return out
    }

    addClass(classNames: string): this {
        for (const cls of splitClasses(classNames)) this.eachElement((el) => el.classList.add(cls))
        return this
    }

    removeClass(classNames: string): this {
        for (const cls of splitClasses(classNames)) this.eachElement((el) => el.classList.remove(cls))
        return this
    }

    toggleClass(classNames: string, on?: boolean): this {
        if (on === true) return this.addClass(classNames)
        if (on === false) return this.removeClass(classNames)
        for (const cls of splitClasses(classNames)) this.eachElement((el) => el.classList.toggle(cls))
        return this
    }
}

function splitClasses(classNames: string): string[] {
    return classNames.split(/\s+/).filter(Boolean)
}

function adjacentElement(node: Node, dir: Direction): Node | undefined {
    for (let cur = dir === R ? node.nextSibling : node.previousSibling; cur; cur = dir === R ? cur.nextSibling : cur.previousSibling) {
        if (cur.nodeType === Node.ELEMENT_NODE) return cur
    }
    return undefined
}

/** Shorthand constructor: `domFrag(node)` or `domFrag(first, last)`. */
export function domFrag(first?: Node | null, last?: Node | null): DOMFragment {
    const f = first ?? undefined
    return new DOMFragment(f, last === undefined ? f : last ?? undefined)
}
