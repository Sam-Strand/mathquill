import type { Ends, Direction } from '../../types'
import type { NodeRef, JoinMethod } from '../../shared_types'
import type { Controller } from '../../services/textarea'
import type { Options } from '../../options'
import type { Cursor, Anticursor } from '../../cursor'

import { NodeBase, MQNode, Fragment  } from '../../tree'
import { L, R } from '../../types'
import { h } from '../../dom'
import { getBoundingClientRect } from '../../browser'
import { Parser } from '../../services/parser.util'

/**
 * Math tree node base class.
 * Some math-tree-specific extensions to MQNode.
 * Both MathBlock's and MathCommand's descend from it.
 */
export class MathElement extends MQNode {
    finalizeInsert(options: Options, cursor: Cursor) {
        var self = this
        self.postOrder(function (node) {
            node.finalizeTree(options)
        })
        self.postOrder(function (node) {
            node.contactWeld(cursor)
        })

        // note: this order is important.
        // empty elements need the empty box provided by blur to
        // be present in order for their dimensions to be measured
        // correctly by 'reflow' handlers.
        self.postOrder(function (node) {
            node.blur(cursor)
        })

        self.postOrder(function (node) {
            node.reflow()
        })
        var selfR = self[R]
        var selfL = self[L]
        if (selfR) selfR.siblingCreated(options, L)
        if (selfL) selfL.siblingCreated(options, R)
        self.bubble(function (node) {
            node.reflow()
            return undefined
        })
    }
    // If the maxDepth option is set, make sure
    // deeply nested content is truncated. Just return
    // false if the cursor is already too deep.
    prepareInsertionAt(cursor: Cursor) {
        var maxDepth = cursor.options.maxDepth
        if (maxDepth !== undefined) {
            var cursorDepth = cursor.depth()
            if (cursorDepth > maxDepth) {
                return false
            }
            this.removeNodesDeeperThan(maxDepth - cursorDepth)
        }
        return true
    }
    // Remove nodes that are more than `cutoff`
    // blocks deep from this node.
    removeNodesDeeperThan(cutoff: number) {
        var depth = 0
        var queue: [[MQNode, number]] = [[this, depth]]
        var current: [MQNode, number] | undefined

        // Do a breadth-first search of this node's descendants
        // down to cutoff, removing anything deeper.
        while ((current = queue.shift())) {
            var c = current
            c[0].children().each(function (child) {
                var i = child.isMathBlock() ? 1 : 0
                depth = c[1] + i

                if (depth <= cutoff) {
                    queue.push([child, depth])
                } else {
                    (i ? child.children() : child).remove()
                }
                return undefined
            })
        }
    }
}

export class DOMView {
    constructor(
        public readonly childCount: number,
        public readonly render: (blocks: MathBlock[]) => Element
    ) { }
}

/**
 * Commands and operators, like subscripts, exponents, or fractions.
 * Descendant commands are organized into blocks.
 */
export class MathCommand extends MathElement {
    replacedFragment: Fragment | undefined
    domView: DOMView
    declare ends: Ends<MQNode>

    constructor(ctrlSeq?: string, domView?: DOMView, textTemplate?: string[]) {
        super()
        this.setCtrlSeqHtmlAndText(ctrlSeq, domView, textTemplate)
    }

    setEnds(ends: Ends<MQNode>) {
        this.ends = ends
    }

    getEnd(dir: Direction): MQNode {
        return this.ends[dir]
    }

    setCtrlSeqHtmlAndText(
        ctrlSeq?: string,
        domView?: DOMView,
        textTemplate?: string[]
    ) {
        if (!this.ctrlSeq) this.ctrlSeq = ctrlSeq
        if (domView) this.domView = domView
        if (textTemplate) this.textTemplate = textTemplate
    }

    // obvious methods
    replaces(replacedFragment: Fragment) {
        replacedFragment.disown()
        this.replacedFragment = replacedFragment
    }
    
    isEmpty() {
        return this.foldChildren(true, function (isEmpty, child) {
            return isEmpty && child.isEmpty()
        })
    }

    parser(): Parser<MQNode | Fragment> {
        throw new Error('parser() not implemented in core; use MathCommand.prototype.parser override');
    }

    // createLeftOf(cursor) and the methods it calls
    createLeftOf(cursor: Cursor) {
        var cmd = this
        var replacedFragment = cmd.replacedFragment

        cmd.createBlocks()
        super.createLeftOf(cursor)
        if (replacedFragment) {
            const cmdEndsL = cmd.getEnd(L)
            replacedFragment.adopt(cmdEndsL, 0, 0)
            replacedFragment.domFrag().appendTo(cmdEndsL.domFrag().oneElement())
            cmd.placeCursor(cursor)
            cmd.prepareInsertionAt(cursor)
        }
        cmd.finalizeInsert(cursor.options, cursor)
        cmd.placeCursor(cursor)
    }

    createBlocks() {
        var cmd = this,
            numBlocks = cmd.numBlocks(),
            blocks = (cmd.blocks = Array(numBlocks))

        for (var i = 0; i < numBlocks; i += 1) {
            var newBlock = (blocks[i] = new MathBlock())
            newBlock.adopt(cmd, cmd.getEnd(R), 0)
        }
    }

    placeCursor(cursor: Cursor) {
        //insert the cursor at the right end of the first empty child, searching
        //left-to-right, or if none empty, the right end child
        cursor.insAtRightEnd(
            this.foldChildren(this.getEnd(L), function (leftward, child) {
                return leftward.isEmpty() ? leftward : child
            })
        )
    }

    // editability methods: called by the cursor for editing, cursor movements,
    // and selection of the MathQuill tree, these all take in a direction and
    // the cursor
    moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
        var updownInto: NodeRef | undefined
        if (updown === 'up') {
            updownInto = this.upInto
        } else if (updown === 'down') {
            updownInto = this.downInto
        }

        const el = updownInto || this.getEnd(-dir as Direction)
        cursor.insAtDirEnd(-dir as Direction, el)
    }

    deleteTowards(dir: Direction, cursor: Cursor) {
        if (this.isEmpty()) cursor[dir] = this.remove()[dir]
        else this.moveTowards(dir, cursor)
    }

    selectTowards(dir: Direction, cursor: Cursor) {
        cursor[-dir as Direction] = this
        cursor[dir] = this[dir]
    }

    unselectInto(dir: Direction, cursor: Cursor) {
        const antiCursor = cursor.anticursor as Anticursor
        const ancestor = antiCursor.ancestors[this.id] as MQNode
        cursor.insAtDirEnd(-dir as Direction, ancestor)
    }

    seek(clientX: number, cursor: Cursor) {
        function getBounds(node: MQNode) {
            const el = node.domFrag().oneElement()
            const l = getBoundingClientRect(el).left
            var r: number = l + el.offsetWidth
            return {
                [L]: l,
                [R]: r,
            }
        }

        var cmd = this
        var cmdBounds = getBounds(cmd)

        if (clientX < cmdBounds[L]) return cursor.insLeftOf(cmd)
        if (clientX > cmdBounds[R]) return cursor.insRightOf(cmd)

        var leftLeftBound = cmdBounds[L]
        cmd.eachChild(function (block) {
            var blockBounds = getBounds(block)
            if (clientX < blockBounds[L]) {
                // closer to this block's left bound, or the bound left of that?
                if (clientX - leftLeftBound < blockBounds[L] - clientX) {
                    if (block[L]) cursor.insAtRightEnd(block[L] as MQNode)
                    else cursor.insLeftOf(cmd)
                } else cursor.insAtLeftEnd(block)
                return false
            } else if (clientX > blockBounds[R]) {
                if (block[R]) leftLeftBound = blockBounds[R]
                // continue to next block
                else {
                    // last (rightmost) block
                    // closer to this block's right bound, or the cmd's right bound?
                    if (cmdBounds[R] - clientX < clientX - blockBounds[R]) {
                        cursor.insRightOf(cmd)
                    } else cursor.insAtRightEnd(block)
                }
                return undefined
            } else {
                block.seek(clientX, cursor)
                return false
            }
        })

        return undefined
    }

    numBlocks() {
        return this.domView.childCount
    }

    /**
     * Render the entire math subtree rooted at this command to a DOM node. Assumes `this.domView` is defined.
     *
     * See dom.test.js for example templates and intended outputs.
     */
    html(): Element | DocumentFragment {
        const blocks = this.blocks
        const template = this.domView
        const dom = template.render(blocks || [])
        this.setDOM(dom)
        NodeBase.linkElementByCmdNode(dom, this)
        return dom
    }

    // methods to export a string representation of the math tree
    latex() {
        return this.foldChildren(this.ctrlSeq || '', function (latex, child) {
            return latex + '{' + (child.latex() || ' ') + '}'
        })
    }

    textTemplate = ['']

    text() {
        var cmd = this,
            i = 0
        return cmd.foldChildren(cmd.textTemplate[i], function (text, child) {
            i += 1
            var child_text = child.text()
            if (
                text &&
                cmd.textTemplate[i] === '(' &&
                child_text[0] === '(' &&
                child_text.slice(-1) === ')'
            )
                return text + child_text.slice(1, -1) + cmd.textTemplate[i]
            return text + child_text + (cmd.textTemplate[i] || '')
        })
    }
}

/**
 * Lightweight command without blocks or children.
 */
export class MQSymbol extends MathCommand {
    constructor(
        ctrlSeq?: string,
        html?: HTMLElement,
        text?: string
    ) {
        super()
        this.setCtrlSeqHtmlText(
            ctrlSeq,
            html
                ? new DOMView(0, () => html.cloneNode(true) as HTMLElement)
                : undefined,
            text
        )
    }

    setCtrlSeqHtmlText(
        ctrlSeq?: string,
        html?: DOMView,
        text?: string
    ) {
        if (!text && !!ctrlSeq) {
            text = ctrlSeq.replace(/^\\/, '')
        }

        super.setCtrlSeqHtmlAndText(ctrlSeq, html, [text || ''])
    }

    parser(): Parser<MQNode | Fragment> {
        return Parser.succeed(this)
    }

    numBlocks() {
        return 0 as const
    }

    replaces(replacedFragment: Fragment) {
        replacedFragment.remove()
    }
    createBlocks() { }

    moveTowards(dir: Direction, cursor: Cursor) {
        cursor.domFrag().insDirOf(dir, this.domFrag())
        cursor[-dir as Direction] = this
        cursor[dir] = this[dir]
    }
    deleteTowards(dir: Direction, cursor: Cursor) {
        cursor[dir] = this.remove()[dir]
    }
    seek(clientX: number, cursor: Cursor) {
        // insert at whichever side the click was closer to
        const el = this.domFrag().oneElement()
        const left = getBoundingClientRect(el).left
        if (clientX - left < el.offsetWidth / 2) cursor.insLeftOf(this)
        else cursor.insRightOf(this)

        return cursor
    }

    latex() {
        return this.ctrlSeq || ''
    }
    text() {
        return this.textTemplate.join('')
    }
    placeCursor() { }
    isEmpty() {
        return true
    }
}

export class VanillaSymbol extends MQSymbol {
    constructor(ch: string, html?: ChildNode) {
        super(ch, h('span', {}, [html || h.text(ch)]), undefined)
    }
}

export class BinaryOperator extends MQSymbol {
    constructor(
        ctrlSeq?: string,
        html?: ChildNode,
        text?: string,
        treatLikeSymbol?: boolean
    ) {
        if (treatLikeSymbol) {
            super(
                ctrlSeq,
                h('span', {}, [html || h.text(ctrlSeq || '')]),
                undefined
            )
        } else {
            super(
                ctrlSeq,
                h('span', { class: 'mq-binary-operator' }, html ? [html] : []),
                text
            )
        }
    }
}

export function bindVanillaSymbol(
    ch: string,
    htmlEntity?: string
) {
    return () =>
        new VanillaSymbol(
            ch,
            htmlEntity ? h.entityText(htmlEntity) : undefined
        )
}

export function bindBinaryOperator(
    ctrlSeq?: string,
    htmlEntity?: string,
    text?: string
) {
    return () =>
        new BinaryOperator(
            ctrlSeq,
            htmlEntity ? h.entityText(htmlEntity) : undefined,
            text
        )
}

/**
 * Children and parent of MathCommand's. Basically partitions all the
 * symbols and operators that descend (in the Math DOM tree) from
 * ancestor operators.
 */
export class MathBlock extends MathElement {
    controller?: Controller

    isMathBlock(): boolean { return true; }

    join(methodName: JoinMethod) {
        return this.foldChildren('', function (fold, child) {
            return fold + child[methodName]()
        })
    }

    html() {
        const fragment = document.createDocumentFragment()
        this.eachChild((el) => {
            const childHtml = el.html()
            fragment.appendChild(childHtml)
            return undefined
        })
        return fragment
    }

    latex() {
        return this.join('latex')
    }

    text() {
        var endsL = this.getEnd(L)
        var endsR = this.getEnd(R)
        return endsL === endsR && endsL !== 0 ? endsL.text() : this.join('text')
    }

    keystroke(key: string, e: KeyboardEvent | undefined, ctrlr: Controller) {
        if (
            ctrlr.options.spaceBehavesLikeTab &&
            (key === 'Spacebar' || key === 'Shift-Spacebar')
        ) {
            e?.preventDefault()
            ctrlr.escapeDir(key === 'Shift-Spacebar' ? L : R, key, e)
            return
        }
        return super.keystroke(key, e, ctrlr)
    }

    // editability methods: called by the cursor for editing, cursor movements,
    // and selection of the MathQuill tree, these all take in a direction and
    // the cursor
    moveOutOf(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
        var updownInto: NodeRef | undefined
        if (updown === 'up') {
            updownInto = this.parent.upInto
        } else if (updown === 'down') {
            updownInto = this.parent.downInto
        }

        if (!updownInto && this[dir]) {
            const otherDir = -dir as Direction
            cursor.insAtDirEnd(otherDir, this[dir] as MQNode)
        } else {
            cursor.insDirOf(dir, this.parent)
        }
    }

    selectOutOf(dir: Direction, cursor: Cursor) {
        cursor.insDirOf(dir, this.parent)
    }

    deleteOutOf(_dir: Direction, cursor: Cursor) {
        cursor.unwrapGramp()
    }

    seek(clientX: number, cursor: Cursor) {
        var node = this.getEnd(R)
        if (!node) return cursor.insAtRightEnd(this)
        const el = node.domFrag().oneElement()
        const left = getBoundingClientRect(el).left
        if (left + el.offsetWidth < clientX) {
            return cursor.insAtRightEnd(this)
        }

        var endsL = this.getEnd(L) as MQNode
        if (clientX < getBoundingClientRect(endsL.domFrag().oneElement()).left)
            return cursor.insAtLeftEnd(this)
        while (clientX < getBoundingClientRect(node.domFrag().oneElement()).left)
            node = node[L] as MQNode
        return node.seek(clientX, cursor)
    }

    focus() {
        this.domFrag().addClass('mq-hasCursor')
        this.domFrag().removeClass('mq-empty')

        return this
    }

    blur(cursor: Cursor) {
        this.domFrag().removeClass('mq-hasCursor')
        if (this.isEmpty()) {
            this.domFrag().addClass('mq-empty')
            if (
                cursor &&
                this.isQuietEmptyDelimiter(cursor.options.quietEmptyDelimiters)
            ) {
                this.domFrag().addClass('mq-quiet-delimiter')
            }
        }
        return this
    }
}

export class RootMathBlock extends MathBlock {}
