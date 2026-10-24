/*********************************************
 * Math tree node classes: blocks, commands and symbols.
 *
 *   MathElement ─┬─ MathBlock        a list of math nodes (child of a command, or a root)
 *                └─ MathCommand      a command with N child blocks (\frac has 2)
 *                     └─ MQSymbol    a command without blocks (x, +, \alpha)
 *********************************************/
import { L, R, opp, type Direction, type Ends } from '../../core/direction'
import { h } from '../../core/dom'
import { domFrag } from '../../core/domFragment'
import { getBoundingClientRect } from '../../core/geometry'
import { Parser } from '../../core/parser'
import { MQNode } from '../../tree/node'
import { Fragment, type NodeRef } from '../../tree/fragment'
import { linkCommandElement } from '../../tree/domLink'
import type { Cursor } from '../../tree/cursor'
import type { Options } from '../../options'
import type { Controller } from '../../controller/Controller'
import { basicNodes, charCommands, latexCommands } from '../registry'
import { latexMathParser } from './latexParser'

/** Math-specific behaviour shared by blocks and commands. */
export class MathElement extends MQNode {
    finalizeInsert(options: Options, cursor: Cursor): void {
        this.postOrder((node) => node.finalizeTree(options))
        this.postOrder((node) => node.contactWeld(cursor))
        // Order matters: empty blocks need the empty box added by blur() to
        // be measured correctly by reflow().
        this.postOrder((node) => node.blur(cursor))
        this.postOrder((node) => node.reflow())
        const selfR = this[R]
        const selfL = this[L]
        if (selfR) selfR.siblingCreated(options, L)
        if (selfL) selfL.siblingCreated(options, R)
        this.bubble((node) => node.reflow())
    }

    /**
     * With the `maxDepth` option, truncate content nested too deeply to be
     * inserted at the cursor. Returns false if the cursor itself is too deep.
     */
    prepareInsertionAt(cursor: Cursor): boolean {
        const maxDepth = cursor.options.maxDepth
        if (maxDepth !== undefined) {
            const cursorDepth = cursor.depth()
            if (cursorDepth > maxDepth) return false
            this.removeNodesDeeperThan(maxDepth - cursorDepth)
        }
        return true
    }

    /** Remove nodes that are more than `cutoff` blocks deep (breadth-first). */
    removeNodesDeeperThan(cutoff: number): void {
        const queue: [MQNode, number][] = [[this, 0]]
        for (let current = queue.shift(); current; current = queue.shift()) {
            const [node, nodeDepth] = current
            node.children().each((child) => {
                const isBlock = child.isMathBlock()
                const depth = nodeDepth + (isBlock ? 1 : 0)
                if (depth <= cutoff) queue.push([child, depth])
                else (isBlock ? child.children() : child).remove()
            })
        }
    }
}

/** How a command renders: number of child blocks and a template producing its DOM. */
export class DOMView {
    constructor(
        readonly childCount: number,
        readonly render: (blocks: MathBlock[]) => Element
    ) {}
}

/** Commands and operators, like subscripts, exponents, or fractions. Children are organized into blocks. */
export class MathCommand extends MathElement {
    declare ends: Ends<MQNode>
    declare blocks: MathBlock[] | undefined
    replacedFragment: Fragment | undefined
    domView: DOMView | undefined
    /**
     * Text export: `textTemplate[0] + block0.text() + textTemplate[1] + block1.text() + ...`.
     * Defaults to the plain concatenation of the blocks.
     */
    textTemplate: readonly string[] = ['']

    constructor(ctrlSeq?: string, domView?: DOMView, textTemplate?: readonly string[]) {
        super()
        if (ctrlSeq !== undefined) this.ctrlSeq = ctrlSeq
        if (domView) this.domView = domView
        if (textTemplate) this.textTemplate = textTemplate
    }

    setEnds(ends: Ends<NodeRef>): void {
        this.ends = ends as Ends<MQNode>
    }

    getEnd(dir: Direction): MQNode {
        return this.ends[dir]
    }

    blockAt(dir: Direction): MathBlock {
        return this.ends[dir] as MathBlock
    }

    /** Wrap `fragment` (usually the selection) in this command when it is created. */
    replaces(fragment: Fragment): void {
        fragment.disown()
        this.replacedFragment = fragment
    }

    isEmpty(): boolean {
        return this.foldChildren(true, (isEmpty, child) => isEmpty && child.isEmpty())
    }

    /** By default a command is followed by one LaTeX block per child block. */
    parser(): Parser<MQNode | Fragment> {
        return latexMathParser.block.times(this.numBlocks()).map((blocks) => {
            this.blocks = blocks
            for (const block of blocks) block.adopt(this, this.getEnd(R), 0)
            return this
        })
    }

    createLeftOf(cursor: Cursor): void {
        const replacedFragment = this.replacedFragment
        this.createBlocks()
        super.createLeftOf(cursor)
        if (replacedFragment) {
            const firstBlock = this.getEnd(L)
            replacedFragment.adopt(firstBlock, 0, 0)
            replacedFragment.domFrag().appendTo(firstBlock.domFrag().oneElement())
            this.placeCursor(cursor)
            this.prepareInsertionAt(cursor)
        }
        this.finalizeInsert(cursor.options, cursor)
        this.placeCursor(cursor)
    }

    /** Create the (empty) child blocks of a command being typed. */
    createBlocks(): void {
        const blocks: MathBlock[] = (this.blocks = [])
        for (let i = 0; i < this.numBlocks(); i += 1) {
            const block = this.newBlock(i)
            blocks.push(block)
            block.adopt(this, this.getEnd(R), 0)
        }
    }

    /** Block class used for typed commands; overridden by commands with special blocks. */
    protected newBlock(_index: number): MathBlock {
        return new MathBlock()
    }

    /** Put the cursor at the right end of the first empty block, or the last block. */
    placeCursor(cursor: Cursor): void {
        cursor.insAtRightEnd(this.foldChildren(this.getEnd(L), (leftward, child) => (leftward.isEmpty() ? leftward : child)))
    }

    // ---- hooks for child blocks -------------------------------------------

    /** A character typed inside one of this command's blocks. */
    writeInBlock(block: MathBlock, cursor: Cursor, ch: string): void {
        block.writeDefault(cursor, ch)
    }

    /** Backspace/Del pressed at the edge of one of this command's blocks. */
    deleteOutOfBlock(_block: MathBlock, _dir: Direction, cursor: Cursor): void {
        cursor.unwrapGramp()
    }

    // ---- editing ----------------------------------------------------------

    moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down'): void {
        const into = (updown === 'up' && this.upInto) || (updown === 'down' && this.downInto) || this.getEnd(opp(dir))
        cursor.insAtDirEnd(opp(dir), into)
    }

    deleteTowards(dir: Direction, cursor: Cursor): void {
        if (this.isEmpty()) cursor[dir] = this.remove()[dir]
        else this.moveTowards(dir, cursor)
    }

    selectTowards(dir: Direction, cursor: Cursor): void {
        cursor[opp(dir)] = this
        cursor[dir] = this[dir]
    }

    unselectInto(dir: Direction, cursor: Cursor): void {
        const ancestor = cursor.anticursor?.ancestors[this.id] as MQNode
        cursor.insAtDirEnd(opp(dir), ancestor)
    }

    seek(clientX: number, cursor: Cursor): void {
        const bounds = (node: MQNode) => {
            const el = node.domFrag().oneElement()
            const left = getBoundingClientRect(el).left
            return { [L]: left, [R]: left + el.offsetWidth }
        }

        const cmdBounds = bounds(this)
        if (clientX < cmdBounds[L]) {
            cursor.insLeftOf(this)
            return
        }
        if (clientX > cmdBounds[R]) {
            cursor.insRightOf(this)
            return
        }

        let leftLeftBound = cmdBounds[L]
        this.eachChild((block) => {
            const blockBounds = bounds(block)
            if (clientX < blockBounds[L]) {
                // closer to this block's left bound, or the bound left of that?
                if (clientX - leftLeftBound < blockBounds[L] - clientX) {
                    if (block[L]) cursor.insAtRightEnd(block[L])
                    else cursor.insLeftOf(this)
                } else cursor.insAtLeftEnd(block)
                return false
            }
            if (clientX > blockBounds[R]) {
                if (block[R]) {
                    leftLeftBound = blockBounds[R] // continue to the next block
                } else if (cmdBounds[R] - clientX < clientX - blockBounds[R]) {
                    // last block: closer to its right bound, or the command's?
                    cursor.insRightOf(this)
                } else cursor.insAtRightEnd(block)
                return
            }
            block.seek(clientX, cursor)
            return false
        })
    }

    numBlocks(): number {
        return this.domView ? this.domView.childCount : 0
    }

    /** Render the subtree rooted at this command. */
    html(): Node {
        if (!this.domView) throw new Error('no DOM view for ' + (this.ctrlSeq ?? this.constructor.name))
        const dom = this.domView.render(this.blocks || [])
        this.setDOM(dom)
        linkCommandElement(dom, this)
        return dom
    }

    latex(): string {
        return this.foldChildren(this.ctrlSeq || '', (latex, child) => latex + '{' + (child.latex() || ' ') + '}')
    }

    text(): string {
        const template = this.textTemplate
        let i = 0
        return this.foldChildren(template[0], (text, child) => {
            i += 1
            const childText = child.text()
            // avoid doubled parentheses, e.g. `(a+b)/(c)` rather than `((a+b))/(c)`
            if (text && template[i] === '(' && childText[0] === '(' && childText.slice(-1) === ')') {
                return text + childText.slice(1, -1) + template[i]
            }
            return text + childText + (template[i] || '')
        })
    }
}

/** A command without blocks: letters, digits, operators, constants. */
export class MQSymbol extends MathCommand {
    private readonly textOverride: string | undefined

    constructor(ctrlSeq?: string, html?: Element, text?: string) {
        super(ctrlSeq, html ? new DOMView(0, () => html.cloneNode(true) as Element) : undefined)
        this.textOverride = text
    }

    parser(): Parser<MQNode | Fragment> {
        return Parser.succeed(this)
    }

    numBlocks(): number {
        return 0
    }

    replaces(fragment: Fragment): void {
        fragment.remove()
    }

    createBlocks(): void {}

    moveTowards(dir: Direction, cursor: Cursor): void {
        cursor.domFrag().insDirOf(dir, this.domFrag())
        cursor[opp(dir)] = this
        cursor[dir] = this[dir]
    }

    deleteTowards(dir: Direction, cursor: Cursor): void {
        cursor[dir] = this.remove()[dir]
    }

    seek(clientX: number, cursor: Cursor): void {
        // insert at whichever side the click was closer to
        const el = this.domFrag().oneElement()
        const left = getBoundingClientRect(el).left
        if (clientX - left < el.offsetWidth / 2) cursor.insLeftOf(this)
        else cursor.insRightOf(this)
    }

    latex(): string {
        return this.ctrlSeq || ''
    }

    text(): string {
        if (this.textOverride !== undefined) return this.textOverride
        return (this.ctrlSeq || '').replace(/^\\/, '').trim()
    }

    placeCursor(): void {}

    isEmpty(): boolean {
        return true
    }
}

/** Commands that only exist in LaTeX input (`\left`, `\mathbb`, ...): typing them inserts nothing. */
export class ParseOnlyCommand extends MathCommand {
    createLeftOf(): void {}
    replaces(fragment: Fragment): void {
        fragment.remove()
    }
    numBlocks(): number {
        return 1
    }
}

export class VanillaSymbol extends MQSymbol {
    constructor(ch: string, html?: Node, text?: string) {
        super(ch, h('span', {}, [html || h.text(ch)]), text)
    }
}

export class BinaryOperator extends MQSymbol {
    constructor(ctrlSeq?: string, html?: Node, treatLikeSymbol?: boolean, text?: string) {
        super(
            ctrlSeq,
            treatLikeSymbol
                ? h('span', {}, [html || h.text(ctrlSeq || '')])
                : h('span', { class: 'mq-binary-operator' }, html ? [html] : []),
            text
        )
    }
}

export function bindVanillaSymbol(ch: string, htmlEntity?: string, text?: string) {
    return () => new VanillaSymbol(ch, htmlEntity ? h.entityText(htmlEntity) : undefined, text)
}

export function bindBinaryOperator(ctrlSeq: string, htmlEntity?: string, text?: string) {
    return () => new BinaryOperator(ctrlSeq, htmlEntity ? h.entityText(htmlEntity) : undefined, false, text)
}

/**
 * A list of math nodes: a child block of a command, or the root of a field.
 * Context-specific behaviour (what typing does inside a superscript, what
 * Backspace does at the edge of a bracket) is delegated to the parent command.
 */
export class MathBlock extends MathElement {
    /** Set on the root block of a field. */
    controller: Controller | undefined

    isMathBlock(): boolean {
        return true
    }

    private owner(): MathCommand | undefined {
        return this.parent instanceof MathCommand ? this.parent : undefined
    }

    join(method: 'latex' | 'text'): string {
        return this.foldChildren('', (fold, child) => fold + child[method]())
    }

    html(): Node {
        const fragment = document.createDocumentFragment()
        this.eachChild((child) => {
            fragment.appendChild(child.html())
        })
        return fragment
    }

    latex(): string {
        return this.join('latex')
    }

    text(): string {
        const endsL = this.getEnd(L)
        return endsL && endsL === this.getEnd(R) ? endsL.text() : this.join('text')
    }

    handleKeystroke(key: string, e: KeyboardEvent | undefined, ctrlr: Controller): boolean {
        if (ctrlr.options.spaceBehavesLikeTab && (key === 'Spacebar' || key === 'Shift-Spacebar')) {
            e?.preventDefault()
            ctrlr.editor.escapeDir(key === 'Shift-Spacebar' ? L : R, e)
            return true
        }
        return false
    }

    // ---- typing -----------------------------------------------------------

    chToCmd(ch: string, options: Options): MQNode {
        if (/^[a-eg-zA-Z]$/.test(ch)) return basicNodes.letter(ch)
        if (/^\d$/.test(ch)) return basicNodes.digit(ch)
        if (ch === '/' && options.typingSlashWritesDivisionSymbol) return latexCommands.create('÷')!
        if (ch === '*' && options.typingAsteriskWritesTimesSymbol) return latexCommands.create('×')!
        if (ch === '%' && options.typingPercentWritesPercentOf) return latexCommands.create('percentof')!
        return charCommands.create(ch) ?? latexCommands.create(ch) ?? new VanillaSymbol(ch)
    }

    write(cursor: Cursor, ch: string): void {
        const owner = this.owner()
        if (owner) owner.writeInBlock(this, cursor, ch)
        else this.writeDefault(cursor, ch)
    }

    /** Insert the command for `ch` at the cursor, wrapping the selection if any. */
    writeDefault(cursor: Cursor, ch: string): void {
        const cmd = this.chToCmd(ch, cursor.options)
        const selection = cursor.selection && cursor.replaceSelection()
        if (selection) cmd.replaces(selection)
        if (!cursor.isTooDeep()) cmd.createLeftOf(cursor.show())
    }

    writeLatex(cursor: Cursor, latex: string): void {
        const block = latexMathParser.skip(Parser.eof).or(Parser.all.result<false>(false)).parse(latex)
        if (!block || block.isEmpty() || !block.prepareInsertionAt(cursor)) return

        block.children().adopt(cursor.parent, cursor[L], cursor[R])
        domFrag(block.html()).insertBefore(cursor.domFrag())
        cursor[L] = block.getEnd(R)
        block.finalizeInsert(cursor.options, cursor)
        const after = (block.getEnd(R) as MQNode)[R]
        const before = (block.getEnd(L) as MQNode)[L]
        if (after) after.siblingCreated(cursor.options, L)
        if (before) before.siblingCreated(cursor.options, R)
        cursor.parent.bubble((node) => node.reflow())
    }

    // ---- editing ----------------------------------------------------------

    moveOutOf(dir: Direction, cursor: Cursor, updown?: 'up' | 'down'): void {
        const updownInto = (updown === 'up' && this.parent.upInto) || (updown === 'down' && this.parent.downInto)
        const sibling = this[dir]
        if (!updownInto && sibling) cursor.insAtDirEnd(opp(dir), sibling)
        else cursor.insDirOf(dir, this.parent)
    }

    selectOutOf(dir: Direction, cursor: Cursor): void {
        cursor.insDirOf(dir, this.parent)
    }

    deleteOutOf(dir: Direction, cursor: Cursor): void {
        const owner = this.owner()
        if (owner) owner.deleteOutOfBlock(this, dir, cursor)
        else cursor.unwrapGramp()
    }

    seek(clientX: number, cursor: Cursor): void {
        let node = this.getEnd(R)
        if (!node) {
            cursor.insAtRightEnd(this)
            return
        }
        const el = node.domFrag().oneElement()
        if (getBoundingClientRect(el).left + el.offsetWidth < clientX) {
            cursor.insAtRightEnd(this)
            return
        }
        const first = this.getEnd(L) as MQNode
        if (clientX < getBoundingClientRect(first.domFrag().oneElement()).left) {
            cursor.insAtLeftEnd(this)
            return
        }
        while (clientX < getBoundingClientRect(node.domFrag().oneElement()).left) node = node[L] as MQNode
        node.seek(clientX, cursor)
    }

    focus(): void {
        this.domFrag().addClass('mq-hasCursor')
        this.domFrag().removeClass('mq-empty')
    }

    blur(cursor?: Cursor): void {
        this.domFrag().removeClass('mq-hasCursor')
        if (this.isEmpty()) {
            this.domFrag().addClass('mq-empty')
            if (cursor && this.isQuietEmptyDelimiter(cursor.options.quietEmptyDelimiters)) {
                this.domFrag().addClass('mq-quiet-delimiter')
            }
        }
    }
}

/**
 * Root block of an editable field. Reaching its edges, or changing its
 * content, is reported to the field's handlers.
 */
export class RootMathBlock extends MathBlock {
    private get ctrl(): Controller {
        if (!this.controller) throw new Error('root block without controller')
        return this.controller
    }

    moveOutOf(dir: Direction): void {
        this.ctrl.handle('moveOutOf', dir)
    }
    deleteOutOf(dir: Direction): void {
        this.ctrl.handle('deleteOutOf', dir)
    }
    selectOutOf(dir: Direction): void {
        this.ctrl.handle('selectOutOf', dir)
    }
    upOutOf = (): undefined => {
        this.ctrl.handle('upOutOf')
        return undefined
    }
    downOutOf = (): undefined => {
        this.ctrl.handle('downOutOf')
        return undefined
    }
    reflow(): void {
        this.ctrl.handle('reflow')
        this.ctrl.handle('edited')
        this.ctrl.handle('edit')
    }
}
