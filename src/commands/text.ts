/*************************************************
 * Text mode: `\text{...}` blocks inside math, and the root of a TextField
 * (plain text with `$...$` math islands).
 ************************************************/
import { L, R, opp, type Direction } from '../core/direction'
import { h, type HTMLTagName } from '../core/dom'
import { Parser } from '../core/parser'
import { MQNode } from '../tree/node'
import { Fragment } from '../tree/fragment'
import { linkCommandElement } from '../tree/domLink'
import { Anticursor, type Cursor } from '../tree/cursor'
import type { Controller } from '../controller/Controller'
import { latexCommands } from './registry'
import { DOMView, MathBlock, MathCommand, RootMathBlock, VanillaSymbol } from './math/core'

/**
 * A run of plain text inside math. Its children are one or more TextPieces
 * (fused into one on blur); it renders as a single span.
 */
export class TextBlock extends MQNode {
    ctrlSeq = '\\text'
    /** Text typed over a selection (from a LatexCommandInput or a replaced fragment). */
    private replacedText: string | undefined
    /** Where mouse selection started, as an offset in the text. */
    private anticursorPosition: number | undefined

    replaces(replaced: Fragment | string): void {
        this.replacedText = replaced instanceof Fragment ? replaced.remove().domFrag().text() : replaced
    }

    /** Also points the first TextPiece at the rendered text node. */
    setDOM(el: Element | Text | undefined): this {
        super.setDOM(el)
        const first = this.getEnd(L)
        if (first) {
            const children = this.domFrag().children()
            if (!children.isEmpty()) first.setDOM(children.oneText())
        }
        return this
    }

    createLeftOf(cursor: Cursor): void {
        super.createLeftOf(cursor)
        cursor.insAtRightEnd(this)

        if (this.replacedText) {
            for (const ch of this.replacedText) this.write(cursor, ch)
        }

        const after = this[R]
        if (after) after.siblingCreated(cursor.options, L)
        const before = this[L]
        if (before) before.siblingCreated(cursor.options, R)
        this.bubble((node) => node.reflow())
    }

    parser(): Parser<MQNode | Fragment> {
        // TODO: properly parse text mode (nested braces, escapes)
        return Parser.optWhitespace
            .then(Parser.string('{'))
            .then(Parser.regex(/^[^}]*/))
            .skip(Parser.string('}'))
            .map((text): MQNode | Fragment => {
                if (text.length === 0) return new Fragment(0, 0)
                new TextPiece(text).adopt(this, 0, 0)
                return this
            })
    }

    textContents(): string {
        return this.foldChildren('', (text, child) => text + (child as TextPiece).textStr)
    }

    latex(): string {
        const contents = this.textContents()
        if (contents.length === 0) return ''
        return this.ctrlSeq + '{' + contents.replace(/\\/g, '\\backslash ').replace(/[{}]/g, '\\$&') + '}'
    }

    /** Tag and attributes of the rendered element. */
    protected element(): { tag: HTMLTagName; attrs: { class: string; style?: string } } {
        return { tag: 'span', attrs: { class: 'mq-text-mode' } }
    }

    html(): Node {
        const { tag, attrs } = this.element()
        const out = h(tag, attrs, [h.text(this.textContents())])
        this.setDOM(out)
        linkCommandElement(out, this)
        return out
    }

    // ---- editing -----------------------------------------------------------

    moveTowards(dir: Direction, cursor: Cursor): void {
        cursor.insAtDirEnd(opp(dir), this)
    }
    moveOutOf(dir: Direction, cursor: Cursor): void {
        cursor.insDirOf(dir, this)
    }
    unselectInto(dir: Direction, cursor: Cursor): void {
        this.moveTowards(dir, cursor)
    }
    selectTowards(dir: Direction, cursor: Cursor): void {
        cursor[opp(dir)] = this
        cursor[dir] = this[dir]
    }
    deleteTowards(dir: Direction, cursor: Cursor): void {
        if (this.isEmpty()) cursor[dir] = this.remove()[dir]
        else this.moveTowards(dir, cursor)
    }
    selectOutOf(dir: Direction, cursor: Cursor): void {
        cursor.insDirOf(dir, this)
    }
    deleteOutOf(_dir: Direction, cursor: Cursor): void {
        // Backspace/Del at the edges don't unwrap
        if (this.isEmpty()) cursor.insRightOf(this)
    }

    write(cursor: Cursor, ch: string): void {
        cursor.show().deleteSelection()

        if (ch !== '$') {
            const cursorL = cursor[L]
            if (!cursorL) new TextPiece(ch).createLeftOf(cursor)
            else if (cursorL instanceof TextPiece) cursorL.appendText(ch)
        } else if (this.isEmpty()) {
            cursor.insRightOf(this)
            new VanillaSymbol('\\$', h.text('$')).createLeftOf(cursor)
        } else if (!cursor[R]) {
            cursor.insRightOf(this)
        } else if (!cursor[L]) {
            cursor.insLeftOf(this)
        } else {
            // `$` in the middle: split into two text blocks
            const leftBlock = new TextBlock()
            const leftPc = this.getEnd(L)
            if (leftPc) {
                leftPc.disown().domFrag().detach()
                leftPc.adopt(leftBlock, 0, 0)
            }
            cursor.insLeftOf(this)
            leftBlock.createDir(L, cursor)
        }
        this.bubble((node) => node.reflow())
    }

    writeLatex(cursor: Cursor, latex: string): void {
        const cursorL = cursor[L]
        if (!cursorL) new TextPiece(latex).createLeftOf(cursor)
        else if (cursorL instanceof TextPiece) cursorL.appendText(latex)
        this.bubble((node) => node.reflow())
    }

    seek(clientX: number, cursor: Cursor): void {
        cursor.hide()
        const textPc = fuseChildren(this)
        if (!textPc) return

        // insert the cursor at the approximate position in the text node
        const range = document.createRange()
        range.selectNodeContents(this.domFrag().children().oneText())
        const rects = range.getClientRects()
        if (rects.length === 1) {
            const { width, left } = rects[0]
            const avgChWidth = width / this.textContents().length
            const approxPosition = Math.round((clientX - left) / avgChWidth)
            if (approxPosition <= 0) cursor.insAtLeftEnd(this)
            else if (approxPosition >= textPc.textStr.length) cursor.insAtRightEnd(this)
            else cursor.insLeftOf(textPc.splitRight(approxPosition))
        } else {
            cursor.insAtLeftEnd(this)
        }

        // then move character by character towards clientX
        let displ = clientX - cursor.show().getBoundingClientRectWithoutMargin().left
        const dir = displ && displ < 0 ? L : R
        let prevDispl: number = dir
        // displ * prevDispl > 0 iff still moving in the same direction
        while (cursor[dir] && displ * prevDispl > 0) {
            ;(cursor[dir] as MQNode).moveTowards(dir, cursor)
            prevDispl = displ
            displ = clientX - cursor.getBoundingClientRectWithoutMargin().left
        }
        if (dir * displ < -dir * prevDispl) (cursor[opp(dir)] as MQNode).moveTowards(opp(dir), cursor)

        const cursorL = cursor[L] as TextPiece | 0
        if (!cursor.anticursor) {
            // about to start mouse-selecting: the anticursor will be put here
            this.anticursorPosition = cursorL ? cursorL.textStr.length : 0
        } else if (cursor.anticursor.parent === this) {
            // mouse-selecting within this block: re-insert the anticursor
            const cursorPosition = cursorL ? cursorL.textStr.length : 0
            const anticursorPosition = this.anticursorPosition ?? 0
            if (anticursorPosition === cursorPosition) {
                cursor.anticursor = Anticursor.fromCursor(cursor)
            } else {
                let newTextPc: TextPiece
                if (anticursorPosition < cursorPosition) {
                    newTextPc = (cursorL as TextPiece).splitRight(anticursorPosition)
                    cursor[L] = newTextPc
                } else {
                    newTextPc = (cursor[R] as TextPiece).splitRight(anticursorPosition - cursorPosition)
                }
                cursor.anticursor = new Anticursor(this, newTextPc[L], newTextPc)
            }
        }
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
        if (!cursor) return
        if (this.textContents() === '') {
            // empty text blocks disappear when the cursor leaves
            this.remove()
            if (cursor[L] === this) cursor[L] = this[L]
            else if (cursor[R] === this) cursor[R] = this[R]
        } else fuseChildren(this)
    }
}

/** Merge all TextPieces of `block` (and their DOM text nodes) into one. */
function fuseChildren(block: TextBlock): TextPiece | undefined {
    block.domFrag().oneElement().normalize()
    const children = block.domFrag().children()
    if (children.isEmpty()) return undefined
    const textNode = children.oneText()
    const piece = new TextPiece(textNode.data)
    piece.setDOM(textNode)
    block.children().disown()
    piece.adopt(block, 0, 0)
    return piece
}

/**
 * Piece of plain text inside a TextBlock; wraps a single DOM Text node,
 * mirrored in `textStr`. Never empty.
 */
export class TextPiece extends MQNode {
    textStr: string

    constructor(text: string) {
        super()
        this.textStr = text
    }

    html(): Node {
        const out = h.text(this.textStr)
        this.setDOM(out)
        return out
    }

    appendText(text: string): void {
        this.textStr += text
        this.domFrag().oneText().appendData(text)
    }

    prependText(text: string): void {
        this.textStr = text + this.textStr
        this.domFrag().oneText().insertData(0, text)
    }

    insTextAtDirEnd(text: string, dir: Direction): void {
        if (dir === R) this.appendText(text)
        else this.prependText(text)
    }

    /** Split at offset `i`; returns the new right piece. */
    splitRight(i: number): TextPiece {
        const newPc = new TextPiece(this.textStr.slice(i)).adopt(this.parent, this, this[R])
        newPc.setDOM(this.domFrag().oneText().splitText(i))
        this.textStr = this.textStr.slice(0, i)
        return newPc
    }

    private endChar(dir: Direction): string {
        return this.textStr.charAt(dir === L ? 0 : this.textStr.length - 1)
    }

    /** Moving the cursor over a character moves that character into the neighbouring piece. */
    moveTowards(dir: Direction, cursor: Cursor): void {
        const ch = this.endChar(opp(dir))
        const from = this[opp(dir)]
        if (from instanceof TextPiece) from.insTextAtDirEnd(ch, dir)
        else new TextPiece(ch).createDir(opp(dir), cursor)
        this.deleteTowards(dir, cursor)
    }

    latex(): string {
        return this.textStr
    }

    deleteTowards(dir: Direction, cursor: Cursor): void {
        if (this.textStr.length > 1) {
            const text = this.domFrag().oneText()
            if (dir === R) {
                text.deleteData(0, 1)
                this.textStr = this.textStr.slice(1)
            } else {
                // order matters: deleteData uses the old length
                text.deleteData(this.textStr.length - 1, 1)
                this.textStr = this.textStr.slice(0, -1)
            }
        } else {
            this.remove()
            cursor[dir] = this[dir]
        }
    }

    selectTowards(dir: Direction, cursor: Cursor): void {
        const anticursor = cursor.anticursor
        if (!anticursor) return

        const ch = this.endChar(opp(dir))
        if (anticursor[dir] === this) {
            const newPc = new TextPiece(ch).createDir(dir, cursor)
            anticursor[dir] = newPc
            cursor.insDirOf(dir, newPc)
        } else {
            const from = this[opp(dir)]
            if (from instanceof TextPiece) {
                from.insTextAtDirEnd(ch, dir)
            } else {
                const newPc = new TextPiece(ch).createDir(opp(dir), cursor)
                const selection = cursor.selection
                if (selection) newPc.domFrag().insDirOf(opp(dir), selection.domFrag())
            }
            if (this.textStr.length === 1 && anticursor[opp(dir)] === this) {
                anticursor[opp(dir)] = this[opp(dir)] // `this` will be removed by deleteTowards
            }
        }
        this.deleteTowards(dir, cursor)
    }
}

latexCommands.define(['text', 'textnormal', 'textrm', 'textup', 'textmd'], TextBlock)

function defineTextStyle(names: string[], ctrlSeq: string, tag: HTMLTagName, attrs: { class: string; style?: string }): void {
    latexCommands.define(
        names,
        class extends TextBlock {
            ctrlSeq = ctrlSeq
            protected element() {
                return { tag, attrs }
            }
        }
    )
}

defineTextStyle(['em', 'italic', 'italics', 'emph', 'textit', 'textsl'], '\\textit', 'i', { class: 'mq-text-mode' })
defineTextStyle(['strong', 'bold', 'textbf'], '\\textbf', 'b', { class: 'mq-text-mode' })
defineTextStyle(['sf', 'textsf'], '\\textsf', 'span', { class: 'mq-sans-serif mq-text-mode' })
defineTextStyle(['tt', 'texttt'], '\\texttt', 'span', { class: 'mq-monospace mq-text-mode' })
defineTextStyle(['textsc'], '\\textsc', 'span', { style: 'font-variant:small-caps', class: 'mq-text-mode' })
defineTextStyle(['uppercase'], '\\uppercase', 'span', { style: 'text-transform:uppercase', class: 'mq-text-mode' })
defineTextStyle(['lowercase'], '\\lowercase', 'span', { style: 'text-transform:lowercase', class: 'mq-text-mode' })

/** `$...$`: a math island inside a TextField. */
export class RootMathCommand extends MathCommand {
    domView = new DOMView(1, (blocks) => h.block('span', { class: 'mq-math-mode' }, blocks[0]))

    constructor() {
        super('$')
    }

    writeInBlock(block: MathBlock, cursor: Cursor, ch: string): void {
        if (ch !== '$') block.writeDefault(cursor, ch)
        else if (block.isEmpty()) {
            // `$$` gives a literal dollar sign
            cursor.insRightOf(this)
            this.deleteTowards(L, cursor)
            new VanillaSymbol('\\$', h.text('$')).createLeftOf(cursor.show())
        } else if (!cursor[R]) cursor.insRightOf(this)
        else if (!cursor[L]) cursor.insLeftOf(this)
        else block.writeDefault(cursor, ch)
    }

    latex(): string {
        return '$' + this.getEnd(L).latex() + '$'
    }
}

/** Root block of a TextField. */
export class RootTextBlock extends RootMathBlock {
    handleKeystroke(key: string, e: KeyboardEvent | undefined, ctrlr: Controller): boolean {
        // a space is typed as text, never treated as a key command
        if (key === 'Spacebar' || key === 'Shift-Spacebar') return true
        return super.handleKeystroke(key, e, ctrlr)
    }

    write(cursor: Cursor, ch: string): void {
        cursor.show().deleteSelection()
        if (ch === '$') {
            new RootMathCommand().createLeftOf(cursor)
        } else {
            const html = ch === '<' ? h.entityText('&lt;') : ch === '>' ? h.entityText('&gt;') : undefined
            new VanillaSymbol(ch, html).createLeftOf(cursor)
        }
    }
}
