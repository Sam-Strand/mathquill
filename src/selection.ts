import { domFrag } from './domFragment'
import { h } from './dom'
import { Fragment, MQNode } from './tree'
import { L, R } from './types'
import type { Ends, Direction } from './types'
import type { NodeRef, JoinMethod } from './shared_types'
import { pray } from './utils'


class MQSelection extends Fragment {
    declare ends: Ends<MQNode>
    _el: HTMLElement | undefined

    constructor(withDir: MQNode, oppDir: MQNode, dir?: Direction) {
        super(withDir, oppDir, dir)
        this._el = h('span', { class: 'mq-selection' })
        this.getDOMFragFromEnds().wrapAll(this._el)
    }

    isCleared() {
        return this._el === undefined
    }

    domFrag() {
        return this.isCleared() ? this.getDOMFragFromEnds() : domFrag(this._el)
    }

    setEnds(ends: Ends<MQNode>) {
        pray('Selection ends are never empty', ends[L] && ends[R])
        this.ends = ends
    }

    getEnd(dir: Direction): MQNode {
        return this.ends[dir]
    }

    adopt(parent: MQNode, leftward: NodeRef, rightward: NodeRef) {
        this.clear()
        return super.adopt(parent, leftward, rightward)
    }
    clear() {
        // NOTE it's important here that DOMFragment::children includes all
        // child nodes (including Text nodes), and not just Element nodes.
        // This makes it more similar to the native DOM childNodes property
        // and jQuery's .collection() method than jQuery's .children() method
        const childFrag = this.getDOMFragFromEnds()
        this.domFrag().replaceWith(childFrag)
        this._el = undefined
        return this
    }
    join(methodName: JoinMethod, separator: string = ''): string {
        return this.fold('', function (fold, child) {
            return fold + separator + child[methodName]()
        })
    }
}

function createSelection(lca: MQNode, leftEnd: MQNode, rightEnd: MQNode): MQSelection {
    return new MQSelection(leftEnd, rightEnd);
}

export {
    MQSelection,
    createSelection
}
