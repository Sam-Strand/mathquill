import type { Direction, Ends } from '../core/direction'
import { domFrag, type DOMFragment } from '../core/domFragment'
import { h } from '../core/dom'
import { Fragment, type NodeRef } from './fragment'
import type { MQNode } from './node'

/** A non-empty fragment that is highlighted in the DOM by wrapping it in a `.mq-selection` span. */
export class MQSelection extends Fragment {
    declare ends: Ends<MQNode>
    private wrapper: HTMLElement | undefined

    constructor(withDir: MQNode, oppDir: MQNode, dir?: Direction) {
        super(withDir, oppDir, dir)
        this.wrapper = h('span', { class: 'mq-selection' })
        this.getDOMFragFromEnds().wrapAll(this.wrapper)
    }

    isCleared(): boolean {
        return this.wrapper === undefined
    }

    domFrag(): DOMFragment {
        return this.wrapper ? domFrag(this.wrapper) : this.getDOMFragFromEnds()
    }

    setEnds(ends: Ends<NodeRef>): void {
        this.ends = ends as Ends<MQNode>
    }

    getEnd(dir: Direction): MQNode {
        return this.ends[dir]
    }

    adopt(parent: MQNode, leftward: NodeRef, rightward: NodeRef): this {
        this.clear()
        return super.adopt(parent, leftward, rightward)
    }

    /** Remove the highlight wrapper, leaving the selected nodes in place. */
    clear(): this {
        // DOMFragment.children includes text nodes, like the DOM's childNodes
        const childFrag = this.getDOMFragFromEnds()
        this.domFrag().replaceWith(childFrag)
        this.wrapper = undefined
        return this
    }

    join(method: 'latex' | 'text', separator = ''): string {
        return this.fold('', (fold, child) => fold + separator + child[method]())
    }
}
