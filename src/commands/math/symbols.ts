/*********************************
 * Symbols for basic mathematics: letters, digits, operators, relations,
 * Greek letters and other constants.
 ********************************/
import { L, R, type Direction } from '../../core/direction'
import { U_NO_BREAK_SPACE } from '../../core/unicode'
import { domFrag } from '../../core/domFragment'
import { h } from '../../core/dom'
import { Parser } from '../../core/parser'
import { Fragment, type NodeRef } from '../../tree/fragment'
import type { MQNode } from '../../tree/node'
import type { Cursor } from '../../tree/cursor'
import type { Options } from '../../options'
import { basicNodes, charCommands, latexCommands } from '../registry'
import { BUILT_IN_OPERATOR_NAMES, TWO_WORD_OPERATOR_NAMES, operatorNameList } from './operatorNames'
import { DOMView, MathCommand, MQSymbol, ParseOnlyCommand, VanillaSymbol, BinaryOperator, MathBlock, bindVanillaSymbol, bindBinaryOperator } from './core'
import { latexMathParser } from './latexParser'
import { SupSub, SubscriptCommand } from './supsub'
import { SummationNotation } from './largeOperators'
import { Bracket } from './brackets'

// ---------------------------------------------------------------------------
// Digit grouping (thin spaces between groups of 3 digits)
// ---------------------------------------------------------------------------

const SPACE = '\\ '
const DOT = '.'

/** A character that takes part in digit grouping: digits, `.` and `\ `. */
class DigitGroupingChar extends MQSymbol {
    private groupingClass: string | undefined

    finalizeTree(opts: Options, dir?: Direction): void {
        this.sharedSiblingMethod(opts, dir)
    }
    siblingDeleted(opts: Options, dir: Direction): void {
        this.sharedSiblingMethod(opts, dir)
    }
    siblingCreated(opts: Options, dir: Direction): void {
        this.sharedSiblingMethod(opts, dir)
    }

    private sharedSiblingMethod(opts: Options, dir?: Direction): void {
        // if the right sibling changed and is itself a DigitGroupingChar, it will fix grouping
        if (dir !== L && this[R] instanceof DigitGroupingChar) return
        this.fixDigitGrouping(opts)
    }

    fixDigitGrouping(opts: Options): void {
        if (!opts.enableDigitGrouping) return

        let left: NodeRef = this
        let right: NodeRef = this
        let spacesFound = 0
        const dots: MQNode[] = []

        const absorb = (node: MQNode): boolean => {
            if (/^[0-9]$/.test(node.ctrlSeq || '')) return true
            if (node.ctrlSeq === SPACE) {
                spacesFound += 1
                return true
            }
            if (node.ctrlSeq === DOT) {
                dots.push(node)
                return true
            }
            return false
        }

        // traverse left as far as possible (starting at this char)
        for (let node: NodeRef = this; node && absorb(node); node = node[L]) left = node
        // traverse right as far as possible (starting right of this char)
        for (let node: NodeRef = right[R]; node && absorb(node); node = node[R]) right = node

        // trim leading and trailing spaces
        while (right !== left && left && left.ctrlSeq === SPACE) {
            left = left[R]
            spacesFound -= 1
        }
        while (right !== left && right && right.ctrlSeq === SPACE) {
            right = right[L]
            spacesFound -= 1
        }

        // only a space
        if (left === right && left && left.ctrlSeq === SPACE) return

        if (spacesFound > 0 || dots.length > 1) {
            removeGroupingBetween(left, right)
        } else if (dots[0]) {
            if (dots[0] !== left) addGroupingBetween(dots[0][L], left)
            // no grouping right of the decimal point (yet)
            if (dots[0] !== right) removeGroupingBetween(dots[0][R], right)
        } else {
            addGroupingBetween(right, left)
        }
    }

    setGroupingClass(cls: string | undefined): void {
        if (this.groupingClass === cls) return
        if (this.groupingClass) this.domFrag().removeClass(this.groupingClass)
        if (cls) this.domFrag().addClass(cls)
        this.groupingClass = cls
    }
}

function removeGroupingBetween(left: NodeRef, right: NodeRef): void {
    for (let node = left; node; node = node[R]) {
        if (node instanceof DigitGroupingChar) node.setGroupingClass(undefined)
        if (node === right) break
    }
}

/** Walks leftwards from `start` to `end`, assigning grouping classes. */
function addGroupingBetween(start: NodeRef, end: NodeRef): void {
    let totalDigits = 0
    for (let node = start; node; node = node[L]) {
        totalDigits += 1
        if (node === end) break
    }

    let numDigitsInFirstGroup = totalDigits % 3
    if (numDigitsInFirstGroup === 0) numDigitsInFirstGroup = 3

    let count = 0
    for (let node = start; node; node = node[L]) {
        count += 1
        let cls: string | undefined
        // only group numbers with at least 4 digits
        if (totalDigits >= 4) {
            if (count === totalDigits) cls = 'mq-group-leading-' + numDigitsInFirstGroup
            else if (count % 3 === 0) cls = 'mq-group-start'
            else cls = 'mq-group-other'
        }
        if (node instanceof DigitGroupingChar) node.setGroupingClass(cls)
        if (node === end) break
    }
}

// ---------------------------------------------------------------------------
// Digits, variables, letters
// ---------------------------------------------------------------------------

export class Digit extends DigitGroupingChar {
    constructor(ch: string) {
        super(ch, h('span', { class: 'mq-digit' }, [h.text(ch)]))
    }

    createLeftOf(cursor: Cursor): void {
        const cursorL = cursor[L]
        const cursorLL = cursorL && cursorL[L]
        const grampa = cursor.parent.parent
        const sub = grampa instanceof SupSub ? grampa.sub : undefined

        if (
            cursor.options.autoSubscriptNumerals &&
            cursor.parent !== sub &&
            ((cursorL instanceof Variable && cursorL.isItalic !== false) ||
                (cursorL instanceof SupSub && cursorLL instanceof Variable && cursorLL.isItalic !== false))
        ) {
            new SubscriptCommand().createLeftOf(cursor)
            super.createLeftOf(cursor)
            cursor.insRightOf(cursor.parent.parent)
        } else super.createLeftOf(cursor)
    }
}

export class Variable extends MQSymbol {
    isItalic?: boolean

    constructor(chOrCtrlSeq: string, html?: Node) {
        super(chOrCtrlSeq, h('var', {}, [html || h.text(chOrCtrlSeq)]))
    }

    text(): string {
        let text = this.ctrlSeq || ''
        if (this.isPartOfOperator) {
            if (text[0] === '\\') text = text.slice(1)
            else if (text[text.length - 1] === ' ') text = text.slice(0, -1)
        } else {
            const left = this[L]
            const right = this[R]
            if (left && !(left instanceof Variable) && !(left instanceof BinaryOperator) && left.ctrlSeq !== '\\ ') {
                text = '*' + text
            }
            if (right && !(right instanceof BinaryOperator) && !(right instanceof SupSub)) text += '*'
        }
        return text
    }
}

function bindVariable(ctrlSeq: string, htmlEntity: string) {
    return () => new Variable(ctrlSeq, h.entityText(htmlEntity))
}

/** A typed letter: may form auto-commands (`pi` → π) and operator names (`sin`). */
export class Letter extends Variable {
    readonly letter: string

    constructor(ch: string) {
        super(ch)
        this.letter = ch
    }

    /** Replace the letters just typed by an auto-command, if they spell one. */
    private checkAutoCmds(cursor: Cursor): void {
        if (this.shouldIgnoreSubstitutionInSimpleSubscript(cursor.options)) return

        const autoCmds = cursor.options.autoCommands
        const maxLength = autoCmds._maxLength || 0
        if (maxLength <= 0) return

        // longest run of plain letters ending here (operator name ends excluded)
        let str = ''
        let l: NodeRef = this
        for (let i = 0; l instanceof Letter && l.ctrlSeq === l.letter && i < maxLength; i += 1) {
            str = l.letter + str
            l = l[L]
        }

        // try substrings, longest first
        for (; str.length; str = str.slice(1)) {
            if (!Object.prototype.hasOwnProperty.call(autoCmds, str) || !latexCommands.has(str)) continue
            let first: NodeRef = this
            for (let i = 1; first && i < str.length; i += 1) first = first[L]
            new Fragment(first, this).remove()
            cursor[L] = (first as MQNode)[L]
            latexCommands.create(str)?.createLeftOf(cursor)
            return
        }
    }

    /** Type `(` after an auto-parenthesized operator name like `sin`. */
    private autoParenthesize(cursor: Cursor): void {
        // already parenthesized
        const right = cursor.parent.getEnd(R)
        if (right instanceof Bracket && right.ctrlSeq === '\\left(') return
        if (this.shouldIgnoreSubstitutionInSimpleSubscript(cursor.options)) return

        const functions = cursor.options.autoParenthesizedFunctions
        const operators = cursor.options.autoOperatorNames
        const maxLength = functions._maxLength || 0

        let str = ''
        let l: NodeRef = this
        for (let i = 0; l instanceof Letter && i < maxLength; i += 1) {
            str = l.letter + str
            l = l[L]
        }
        // only auto-parenthesize functions that are also operator names
        for (; str.length; str = str.slice(1)) {
            if (Object.prototype.hasOwnProperty.call(functions, str) && Object.prototype.hasOwnProperty.call(operators, str)) {
                cursor.parent.write(cursor, '(')
                return
            }
        }
    }

    createLeftOf(cursor: Cursor): void {
        super.createLeftOf(cursor)
        this.checkAutoCmds(cursor)
        this.autoParenthesize(cursor)
    }

    italicize(italic: boolean): this {
        this.isItalic = italic
        this.isPartOfOperator = !italic
        this.domFrag().toggleClass('mq-operator-name', !italic)
        return this
    }

    finalizeTree(opts: Options, dir?: Direction): void {
        this.sharedSiblingMethod(opts, dir)
    }
    siblingDeleted(opts: Options, dir: Direction): void {
        this.sharedSiblingMethod(opts, dir)
    }
    siblingCreated(opts: Options, dir: Direction): void {
        this.sharedSiblingMethod(opts, dir)
    }

    private sharedSiblingMethod(opts: Options, dir?: Direction): void {
        // if the right sibling changed and is a Letter, it will un-italicize everyone
        if (dir !== L && this[R] instanceof Letter) return
        this.autoUnItalicize(opts)
    }

    /** Find operator names among the contiguous letters around this one and render them upright. */
    private autoUnItalicize(opts: Options): void {
        const autoOps = opts.autoOperatorNames
        if (autoOps._maxLength === 0) return
        if (this.shouldIgnoreSubstitutionInSimpleSubscript(opts)) return

        // the entire contiguous sequence of letters
        let str = this.letter
        let l = this[L]
        for (; l instanceof Letter; l = l[L]) str = l.letter + str
        let r = this[R]
        for (; r instanceof Letter; r = r[R]) str += r.letter

        // reset all letters before looking for operator names
        const firstLetter = (l && l[R]) || this.parent.getEnd(L)
        const lastLetter = (r && r[L]) || this.parent.getEnd(R)
        new Fragment(firstLetter, lastLetter).each((el) => {
            if (el instanceof Letter) {
                el.italicize(true).domFrag().removeClass('mq-first mq-last mq-followed-by-supsub')
                el.ctrlSeq = el.letter
            }
        })

        const maxLength = autoOps._maxLength || 0

        // at each position left to right, try substrings longest to shortest
        let first: NodeRef = (l && l[R]) || this.parent.getEnd(L)
        outer: for (let i = 0; first && i < str.length; i += 1, first = first[R]) {
            for (let len = Math.min(maxLength, str.length - i); len > 0; len -= 1) {
                const word = str.slice(i, i + len)
                if (!Object.prototype.hasOwnProperty.call(autoOps, word)) continue

                let last: MQNode = first
                let letter: NodeRef = first
                for (let j = 0; j < len && letter; j += 1, letter = letter[R]) {
                    if (letter instanceof Letter) {
                        letter.italicize(false)
                        last = letter
                    }
                }

                const isBuiltIn = BUILT_IN_OPERATOR_NAMES.has(word)
                first.ctrlSeq = (isBuiltIn ? '\\' : '\\operatorname{') + first.ctrlSeq
                last.ctrlSeq += isBuiltIn ? ' ' : '}'

                if (TWO_WORD_OPERATOR_NAMES.has(word)) {
                    // the first word is 3 letters: lim|sup, lim|inf, proj|lim (4), inj|lim
                    const lastL = last[L]
                    const lastLL = lastL && lastL[L]
                    const lastLLL = lastLL && lastLL[L]
                    if (lastLLL) lastLLL.domFrag().addClass('mq-last')
                }

                if (!shouldOmitPadding(first[L])) first.domFrag().addClass('mq-first')
                if (!shouldOmitPadding(last[R])) {
                    const after = last[R]
                    if (after instanceof SupSub) after.markAfterOperatorName()
                    else last.domFrag().toggleClass('mq-last', !(after instanceof Bracket))
                }

                i += len - 1
                first = last
                continue outer
            }
        }
    }
}

/** Whether no padding is needed between an operator name and `node`. */
function shouldOmitPadding(node: NodeRef): boolean {
    if (!node) return true
    // no padding before `.`, binary operators (already padded) or big operators
    return node.ctrlSeq === '.' || node instanceof BinaryOperator || node instanceof SummationNotation
}

basicNodes.letter = (ch) => new Letter(ch)
basicNodes.digit = (ch) => new Digit(ch)

/** `\sin`, `\log` ... parse into their letters (which then get un-italicized). */
class OperatorName extends MQSymbol {
    constructor(fn = '') {
        super(fn)
    }
    get name(): string {
        return this.ctrlSeq || ''
    }
    createLeftOf(cursor: Cursor): void {
        for (const ch of this.name) new Letter(ch).createLeftOf(cursor)
    }
    parser(): Parser<MQNode | Fragment> {
        const block = new MathBlock()
        for (const ch of this.name) new Letter(ch).adopt(block, block.getEnd(R), 0)
        return Parser.succeed(block.children())
    }
}
latexCommands.define(operatorNameList(), OperatorName)

export const AnsBuilder = () => new MQSymbol('\\operatorname{ans}', h('span', { class: 'mq-ans' }, [h.text('ans')]), 'ans')
latexCommands.define('ans', AnsBuilder)

export const PercentOfBuilder = () =>
    new MQSymbol('\\%\\operatorname{of}', h('span', { class: 'mq-nonSymbola mq-operator-name' }, [h.text('% of ')]), '% of')
latexCommands.define(['percent', 'percentof'], PercentOfBuilder)

/** `\operatorname{name}` */
latexCommands.define(
    'operatorname',
    class extends ParseOnlyCommand {
        parser() {
            return latexMathParser.block.map((b): MQNode | Fragment => {
                // `\operatorname{ans}` has a special rendering
                let isAllLetters = true
                let str = ''
                const children = b.children()
                children.each((child) => {
                    if (child instanceof Letter) str += child.letter
                    else isAllLetters = false
                })
                if (isAllLetters && str === 'ans') return AnsBuilder()
                return children
            })
        }
    }
)

latexCommands.define(
    'f',
    class extends Letter {
        constructor() {
            super('f')
            this.domView = new DOMView(0, () => h('var', { class: 'mq-f' }, [h.text('f')]))
        }
        italicize(italic: boolean): this {
            this.domFrag().eachElement((el) => (el.textContent = 'f'))
            this.domFrag().toggleClass('mq-f', italic)
            return super.italicize(italic)
        }
    }
)

// ---------------------------------------------------------------------------
// Vanilla symbols
// ---------------------------------------------------------------------------

latexCommands.define([' ', 'space'], () => new DigitGroupingChar('\\ ', h('span', {}, [h.text(U_NO_BREAK_SPACE)]), ' '))
latexCommands.define('.', () => new DigitGroupingChar('.', h('span', { class: 'mq-digit' }, [h.text('.')])))

latexCommands.define(["'", 'prime'], bindVanillaSymbol("'", '&prime;'))
latexCommands.define(['″', 'dprime'], bindVanillaSymbol('″', '&Prime;'))
latexCommands.define('backslash', bindVanillaSymbol('\\backslash ', '\\'))
latexCommands.define('$', bindVanillaSymbol('\\$', '$', '$'))
latexCommands.define('square', bindVanillaSymbol('\\square ', '□'))
latexCommands.define('mid', bindVanillaSymbol('\\mid ', '∣', '|'))

/** Symbol that does not use the Symbola font. */
class NonSymbolaSymbol extends MQSymbol {
    constructor(ch: string, html?: Node, text?: string) {
        super(ch, h('span', { class: 'mq-nonSymbola' }, [html || h.text(ch)]), text)
    }
}

latexCommands.define('@', () => new NonSymbolaSymbol('@'))
latexCommands.define('&', () => new NonSymbolaSymbol('\\&', h.entityText('&amp;'), '&'))
latexCommands.define(
    '%',
    class extends NonSymbolaSymbol {
        constructor() {
            super('\\%', h.text('%'), '%')
        }
        parser() {
            // parse `\%\operatorname{of}` as one `percentof` node, so it serializes and deletes as a unit
            return Parser.optWhitespace
                .then(Parser.string('\\operatorname{of}').map((): MQNode => PercentOfBuilder()))
                .or(super.parser())
        }
    }
)

latexCommands.define(['∥', 'parallel'], bindVanillaSymbol('\\parallel ', '&#x2225;'))
latexCommands.define(['∦', 'nparallel'], bindVanillaSymbol('\\nparallel ', '&#x2226;'))
latexCommands.define(['⟂', 'perp'], bindVanillaSymbol('\\perp ', '&#x27C2;'))

// ---------------------------------------------------------------------------
// Greek letters (http://www.ams.org/STIX/ion/stixsig03.html)
// ---------------------------------------------------------------------------

latexCommands.define(
    'alpha beta gamma delta zeta eta theta iota kappa mu nu xi rho sigma tau chi psi omega'.split(' '),
    (name) => new Variable('\\' + name + ' ', h.entityText('&' + name + ';'))
)
latexCommands.define('phi', bindVariable('\\phi ', '&#981;'))
latexCommands.define(['phiv', 'varphi'], bindVariable('\\varphi ', '&phi;'))
latexCommands.define('epsilon', bindVariable('\\epsilon ', '&#1013;'))
latexCommands.define(['epsiv', 'varepsilon'], bindVariable('\\varepsilon ', '&epsilon;'))
latexCommands.define(['piv', 'varpi'], bindVariable('\\varpi ', '&piv;'))
latexCommands.define(['sigmaf', 'sigmav', 'varsigma'], bindVariable('\\varsigma ', '&sigmaf;'))
latexCommands.define(['thetav', 'vartheta', 'thetasym'], bindVariable('\\vartheta ', '&thetasym;'))
latexCommands.define(['upsilon', 'upsi'], bindVariable('\\upsilon ', '&upsilon;'))
latexCommands.define(['gammad', 'Gammad', 'digamma'], bindVariable('\\digamma ', '&#989;'))
latexCommands.define(['kappav', 'varkappa'], bindVariable('\\varkappa ', '&#1008;'))
latexCommands.define(['rhov', 'varrho'], bindVariable('\\varrho ', '&#1009;'))

// Greek constants look best upright in Times New Roman
latexCommands.define(['pi', 'π'], () => new NonSymbolaSymbol('\\pi ', h.entityText('&pi;'), 'pi'))
latexCommands.define('lambda', () => new NonSymbolaSymbol('\\lambda ', h.entityText('&lambda;'), 'lambda'))

// Symbola's "upsilon with hook" is a capital Y without hooks, so use a serif font
latexCommands.define(
    ['Upsilon', 'Upsi', 'upsih', 'Upsih'],
    () => new MQSymbol('\\Upsilon ', h('var', { style: 'font-family: serif' }, [h.entityText('&upsih;')]))
)

latexCommands.define(
    'Gamma Delta Theta Lambda Xi Pi Sigma Phi Psi Omega forall'.split(' '),
    (name) => new VanillaSymbol('\\' + name + ' ', h.entityText('&' + name + ';'))
)

// ---------------------------------------------------------------------------
// Symbols that expand to a fragment of LaTeX
// ---------------------------------------------------------------------------

/** A command that inserts a whole fragment, given as LaTeX (e.g. `²` → `^2`). */
class LatexFragment extends MathCommand {
    constructor(readonly latexStr: string) {
        super()
    }

    createLeftOf(cursor: Cursor): void {
        const block = latexMathParser.parse(this.latexStr)
        block.children().adopt(cursor.parent, cursor[L], cursor[R])
        cursor[L] = block.getEnd(R)
        domFrag(block.html()).insertBefore(cursor.domFrag())
        block.finalizeInsert(cursor.options, cursor)
        const after = (block.getEnd(R) as MQNode)?.[R]
        if (after) after.siblingCreated(cursor.options, L)
        const before = (block.getEnd(L) as MQNode)?.[L]
        if (before) before.siblingCreated(cursor.options, R)
        cursor.parent.bubble((node) => node.reflow())
    }

    parser(): Parser<MQNode | Fragment> {
        return Parser.succeed(latexMathParser.parse(this.latexStr).children())
    }
}

// Unicode super-/subscript digits and vulgar fractions, which Word likes to paste
const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹'
for (let i = 0; i < superscripts.length; i += 1) {
    latexCommands.define(superscripts[i], () => new LatexFragment('^' + i))
}
latexCommands.define('¼', () => new LatexFragment('\\frac14'))
latexCommands.define('½', () => new LatexFragment('\\frac12'))
latexCommands.define('¾', () => new LatexFragment('\\frac34'))
// pasting √ inserts a square root (the pasted radicand stays outside, a known limitation)
latexCommands.define('√', () => new LatexFragment('\\sqrt{}'))

// ---------------------------------------------------------------------------
// Plus/minus: binary or unary depending on the left neighbour
// ---------------------------------------------------------------------------

function isBinaryOperator(node: NodeRef): boolean {
    if (!node) return false
    const nodeL = node[L]
    if (nodeL) {
        // unary after another operator, a separator or an opening bracket
        return !(nodeL instanceof BinaryOperator || /^(\\ )|[,;:([]$/.test(nodeL.ctrlSeq || ''))
    }
    // at the left edge of a style block, look through the style block
    if (node.parent && node.parent.parent && node.parent.parent.isStyleBlock()) {
        return isBinaryOperator(node.parent.parent)
    }
    return false
}

export class PlusMinus extends BinaryOperator {
    constructor(ch?: string, html?: Node, text?: string) {
        super(ch, html, true, text)
    }

    contactWeld(_cursor: Cursor, dir?: Direction): void {
        this.updateClass(dir)
    }
    siblingCreated(_opts: Options, dir: Direction): void {
        this.updateClass(dir)
    }
    siblingDeleted(_opts: Options, dir: Direction): void {
        this.updateClass(dir)
    }

    /** Space like a binary operator unless used as a sign. */
    private updateClass(dir?: Direction): void {
        if (dir === R) return // only the left neighbour matters
        this.domFrag().oneElement().className = isBinaryOperator(this) ? 'mq-binary-operator' : ''
    }
}

latexCommands.define(
    '+',
    class extends PlusMinus {
        constructor() {
            super('+', h.text('+'))
        }
    }
)

class MinusNode extends PlusMinus {
    constructor() {
        super('-', h.entityText('&minus;'))
    }
}
// unicode minus, em-dash, en-dash, hyphen
latexCommands.define(['−', '—', '–', '-'], MinusNode)

latexCommands.define(['±', 'pm', 'plusmn', 'plusminus'], () => new PlusMinus('\\pm ', h.entityText('&plusmn;'), '+-'))
latexCommands.define(['mp', 'mnplus', 'minusplus'], () => new PlusMinus('\\mp ', h.entityText('&#8723;'), '-+'))

// semantically &sdot;, but &middot; looks better
const cdot = bindBinaryOperator('\\cdot ', '&middot;', '*')
charCommands.define('*', cdot)
latexCommands.define(['sdot', 'cdot'], cdot)

// ---------------------------------------------------------------------------
// Composite operators: typing `-` `>` gives →, `~~` gives ≈ (and Backspace undoes)
// ---------------------------------------------------------------------------

/** Replace the node left of the cursor (`old`) by `replacement`, then reflow. */
function retype(cursor: Cursor, old: MQNode, replacement: MQNode, oldAndThis?: MQNode): void {
    if (oldAndThis) new Fragment(old, oldAndThis).remove()
    else old.remove()
    cursor[L] = old[L]
    replacement.createLeftOf(cursor)
    ;(cursor[L] as MQNode).bubble((node) => node.reflow())
}

class To extends BinaryOperator {
    constructor() {
        super('\\to ', h.entityText('&rarr;'), false, '->')
    }
    deleteTowards(dir: Direction, cursor: Cursor): void {
        if (dir === L) {
            retype(cursor, cursor[L] as MQNode, new MinusNode(), this)
            return
        }
        super.deleteTowards(dir, cursor)
    }
}
latexCommands.define(['→', 'to'], To)

interface InequalityData {
    ctrlSeq: string
    ctrlSeqStrict: string
    htmlEntity: string
    htmlEntityStrict: string
    text: string
    textStrict: string
}

const LESS: InequalityData = {
    ctrlSeq: '\\le ',
    htmlEntity: '&le;',
    text: '≤',
    ctrlSeqStrict: '<',
    htmlEntityStrict: '&lt;',
    textStrict: '<',
}
const GREATER: InequalityData = {
    ctrlSeq: '\\ge ',
    htmlEntity: '&ge;',
    text: '≥',
    ctrlSeqStrict: '>',
    htmlEntityStrict: '&gt;',
    textStrict: '>',
}

/** `<` / `>`; typing `=` after a strict one makes it `≤` / `≥`, Backspace reverts. */
class Inequality extends BinaryOperator {
    constructor(
        private readonly data: InequalityData,
        public strict: boolean
    ) {
        super(strict ? data.ctrlSeqStrict : data.ctrlSeq, h.entityText(strict ? data.htmlEntityStrict : data.htmlEntity))
    }

    swap(strict: boolean): void {
        this.strict = strict
        this.ctrlSeq = strict ? this.data.ctrlSeqStrict : this.data.ctrlSeq
        this.domFrag()
            .children()
            .replaceWith(domFrag(h.entityText(strict ? this.data.htmlEntityStrict : this.data.htmlEntity)))
    }

    text(): string {
        return this.strict ? this.data.textStrict : this.data.text
    }

    deleteTowards(dir: Direction, cursor: Cursor): void {
        if (dir === L && !this.strict) {
            this.swap(true)
            this.bubble((node) => node.reflow())
            return
        }
        super.deleteTowards(dir, cursor)
    }
}

class Greater extends Inequality {
    constructor() {
        super(GREATER, true)
    }
    createLeftOf(cursor: Cursor): void {
        const cursorL = cursor[L]
        if (cursorL instanceof BinaryOperator && cursorL.ctrlSeq === '-') {
            retype(cursor, cursorL, new To())
            return
        }
        super.createLeftOf(cursor)
    }
}

latexCommands.define(['<', 'lt'], () => new Inequality(LESS, true))
latexCommands.define(['>', 'gt'], Greater)
latexCommands.define(['≤', 'le', 'leq'], () => new Inequality(LESS, false))
latexCommands.define(['≥', 'ge', 'geq'], () => new Inequality(GREATER, false))
latexCommands.define(['infty', 'infin', 'infinity'], bindVanillaSymbol('\\infty ', '&infin;'))
latexCommands.define(['≠', 'ne', 'neq'], bindBinaryOperator('\\ne ', '&ne;', '≠'))

export class Equality extends BinaryOperator {
    constructor() {
        super('=', h.text('='))
    }
    createLeftOf(cursor: Cursor): void {
        const cursorL = cursor[L]
        if (cursorL instanceof Inequality && cursorL.strict) {
            cursorL.swap(false)
            cursorL.bubble((node) => node.reflow())
            return
        }
        super.createLeftOf(cursor)
    }
}
latexCommands.define('=', Equality)

latexCommands.define(['×', 'times'], bindBinaryOperator('\\times ', '&times;', '[x]'))
latexCommands.define(['÷', 'div', 'divide', 'divides'], bindBinaryOperator('\\div ', '&divide;', '[/]'))

class Sim extends BinaryOperator {
    constructor() {
        super('\\sim ', h.text('~'), false, '~')
    }
    createLeftOf(cursor: Cursor): void {
        const cursorL = cursor[L]
        if (cursorL instanceof Sim) {
            retype(cursor, cursorL, new Approx())
            return
        }
        super.createLeftOf(cursor)
    }
}

class Approx extends BinaryOperator {
    constructor() {
        super('\\approx ', h.entityText('&approx;'), false, '~~')
    }
    deleteTowards(dir: Direction, cursor: Cursor): void {
        if (dir === L) {
            retype(cursor, cursor[L] as MQNode, new Sim(), this)
            return
        }
        super.deleteTowards(dir, cursor)
    }
}

charCommands.define('~', Sim)
latexCommands.define('sim', Sim)
latexCommands.define(['≈', 'approx'], Approx)
