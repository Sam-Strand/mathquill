/***************************
 * Delimiters: (), [], {}, ⟨⟩, ||, ‖‖ and \binom.
 *
 * A typed bracket starts one-sided, with a "ghost" partner at the far end
 * of the current block, until the opposing bracket is typed.
 **************************/
import { L, R, opp, type Direction, type Ends } from '../../core/direction'
import { domFrag, type DOMFragment } from '../../core/domFragment'
import { h } from '../../core/dom'
import { Parser } from '../../core/parser'
import { Fragment, type NodeRef } from '../../tree/fragment'
import type { MQNode } from '../../tree/node'
import type { Cursor } from '../../tree/cursor'
import type { Options } from '../../options'
import { charCommands, latexCommands } from '../registry'
import { DOMView, MathCommand, ParseOnlyCommand, type MathBlock } from './core'
import { latexMathParser } from './latexParser'
import { SVG_SYMBOLS, type ScalableSymbol } from './svgSymbols'
import { takeLeftTermAsFirstBlock } from './fraction'
import config from './brackets-config.mkon'

/** 0 = two-sided; L / R = only the left / right bracket is real, the other is a ghost. */
export type BracketSide = Direction | 0

/** A command with delimiter elements as its first and last DOM children. */
class DelimsNode extends MathCommand {
    delimFrags: Ends<DOMFragment> = { [L]: domFrag(), [R]: domFrag() }

    setDOM(el: Element | Text | undefined): this {
        super.setDOM(el)
        const children = this.domFrag().children()
        if (!children.isEmpty()) this.delimFrags = { [L]: children.first(), [R]: children.last() }
        return this
    }
}

/** Every bracket and every control sequence mapped to its counterpart. */
const OPP_BRACKS: Record<string, string> = {}
for (const { open, close, openLatex, closeLatex } of config.pairs) {
    OPP_BRACKS[open] = close
    OPP_BRACKS[close] = open
    OPP_BRACKS[openLatex] = closeLatex
    OPP_BRACKS[closeLatex] = openLatex
}

/** Mismatched closers that are still accepted, as in the interval `[a, b)`. */
const TOLERATED_CLOSE: Record<string, string> = {}
for (const { open, close } of config.tolerantPairs) TOLERATED_CLOSE[open] = close

const NO_SYMBOL: ScalableSymbol = { width: '0', html: () => h.text('') }

interface BracketSideInfo {
    ch: string
    ctrlSeq: string
}

export class Bracket extends DelimsNode {
    declare ends: Ends<MathBlock>
    side: BracketSide
    sides: Ends<BracketSideInfo>
    /** finalizeTree has run once; afterwards it (and intentionalBlur) solidify a one-sided bracket. */
    private finalized = false

    constructor(side: BracketSide, open: string, close: string, ctrlSeq: string, end: string) {
        super('\\left' + ctrlSeq)
        this.side = side
        this.sides = {
            [L]: { ch: open, ctrlSeq: ctrlSeq },
            [R]: { ch: close, ctrlSeq: end },
        }
    }

    numBlocks(): number {
        return 1
    }

    html(): Node {
        const leftSymbol = this.getSymbol(L)
        const rightSymbol = this.getSymbol(R)
        // built at render time, so that `side` may be set by createLeftOf or the parser first
        this.domView = new DOMView(1, (blocks) =>
            h('span', { class: 'mq-non-leaf mq-bracket-container' }, [
                h(
                    'span',
                    {
                        style: 'width:' + leftSymbol.width,
                        class: 'mq-scaled mq-bracket-l mq-paren' + (this.side === R ? ' mq-ghost' : ''),
                    },
                    [leftSymbol.html()]
                ),
                h.block(
                    'span',
                    {
                        style: 'margin-left:' + leftSymbol.width + ';margin-right:' + rightSymbol.width,
                        class: 'mq-bracket-middle mq-non-leaf',
                    },
                    blocks[0]
                ),
                h(
                    'span',
                    {
                        style: 'width:' + rightSymbol.width,
                        class: 'mq-scaled mq-bracket-r mq-paren' + (this.side === L ? ' mq-ghost' : ''),
                    },
                    [rightSymbol.html()]
                ),
            ])
        )
        return super.html()
    }

    getSymbol(side: BracketSide): ScalableSymbol {
        return SVG_SYMBOLS[this.sides[side || R].ch] || NO_SYMBOL
    }

    latex(): string {
        return '\\left' + this.sides[L].ctrlSeq + this.getEnd(L).latex() + '\\right' + this.sides[R].ctrlSeq
    }

    /** `node` if it is a one-sided bracket that can pair with this one on `expectedSide`, else false. */
    matchBrack(opts: Options, expectedSide: BracketSide, node: NodeRef | undefined): Bracket | false {
        if (!(node instanceof Bracket) || !node.side || node.side === -expectedSide) return false
        if (opts.restrictMismatchedBrackets) {
            const mine = this.sides[this.side || R].ch
            const matches =
                OPP_BRACKS[mine] === node.sides[node.side].ch ||
                TOLERATED_CLOSE[this.sides[L].ch] === node.sides[R].ch
            if (!matches) return false
        }
        return node
    }

    /** Make `brack` (a one-sided bracket) two-sided, closing it with my bracket. */
    closeOpposing(brack: Bracket): void {
        const side = this.side as Direction
        brack.side = 0
        brack.sides[side] = this.sides[side] // copy my info (may be mismatched, like [a, b))
        const brackFrag = brack.delimFrags[side].removeClass('mq-ghost')
        this.replaceBracket(brackFrag, side)
    }

    createLeftOf(cursor: Cursor): void {
        let brack: Bracket | false = false
        if (!this.replacedFragment) {
            // unless wrapping the selection, check if next to or inside an opposing one-sided bracket
            const opts = cursor.options
            if (this.sides[L].ch === '|') {
                // a pipe may pair on either side
                brack =
                    this.matchBrack(opts, R, cursor[R]) ||
                    this.matchBrack(opts, L, cursor[L]) ||
                    this.matchBrack(opts, 0, cursor.parent.parent)
            } else {
                const side = this.side as Direction
                brack =
                    this.matchBrack(opts, opp(side), cursor[opp(side)]) ||
                    this.matchBrack(opts, opp(side), cursor.parent.parent)
            }
        }

        let target: Bracket
        let side: BracketSide
        if (brack) {
            target = brack
            side = this.side = -brack.side as BracketSide // a pipe may not have its side set yet
            this.closeOpposing(brack)
            if (brack === cursor.parent.parent && side && cursor[side]) {
                // move the content between me and the ghost outside
                new Fragment(cursor[side], cursor.parent.getEnd(side), opp(side))
                    .disown()
                    .withDirAdopt(opp(side), brack.parent, brack, brack[side])
                    .domFrag()
                    .insDirOf(side, brack.domFrag())
            }
            brack.bubble((node) => node.reflow())
        } else {
            target = this
            side = this.side
            if (this.replacedFragment) {
                this.side = 0 // wrapping the selection: two-sided
            } else if (side && cursor[opp(side)]) {
                // auto-expand so the ghost is at the far end
                this.replaces(new Fragment(cursor[opp(side)], cursor.parent.getEnd(opp(side)), side))
                cursor[opp(side)] = 0
            }
            super.createLeftOf(cursor)
        }
        if (side === L) cursor.insAtLeftEnd(target.getEnd(L))
        else cursor.insRightOf(target)
    }

    placeCursor(): void {}

    /** Replace me by my contents. */
    unwrap(): void {
        this.getEnd(L).children().disown().adopt(this.parent, this, this[R]).domFrag().insertAfter(this.domFrag())
        this.remove()
    }

    /** Delete the bracket on `side` (`outward`: Backspace/Del pressed outside the brackets). */
    deleteSide(side: Direction, outward: boolean, cursor: Cursor): void {
        const parent = this.parent
        const sib = this[side]
        const farEnd = parent.getEnd(side)

        const placeCursorNextTo = () => {
            if (sib) cursor.insDirOf(opp(side), sib)
            else cursor.insAtDirEnd(side, parent)
        }

        if (side === this.side) {
            // deleting the real side of a one-sided bracket: unwrap
            this.unwrap()
            placeCursorNextTo()
            return
        }

        const opts = cursor.options
        const wasSolid = !this.side
        this.side = opp(side)
        const inner = this.getEnd(L).getEnd(this.side)
        if (this.matchBrack(opts, side, inner)) {
            // deleting the outer close-brace of `[(1+2)+3}` where the inner open-paren
            // is a ghost: close the inner one with my bracket, giving `[1+2)+3`
            this.closeOpposing(inner as Bracket)
            const origEnd = this.getEnd(L).getEnd(side)
            this.unwrap()
            if (origEnd) origEnd.siblingCreated(cursor.options, side)
            placeCursorNextTo()
            return
        }

        if (this.matchBrack(opts, side, this.parent.parent)) {
            // deleting the inner close-brace of `([1+2}+3)` where the outer
            // open-paren is a ghost: become `[1+2+3)`
            const outer = this.parent.parent as Bracket
            outer.closeOpposing(this)
            outer.unwrap()
        } else if (outward && wasSolid) {
            // deleting outward from a solid pair: unwrap
            this.unwrap()
            placeCursorNextTo()
            return
        } else {
            // deleting one of a pair: become one-sided
            this.sides[side] = oppositeBracketSide(this)
            this.delimFrags[L].removeClass('mq-ghost')
            this.delimFrags[R].removeClass('mq-ghost')
            const brackFrag = this.delimFrags[side].addClass('mq-ghost')
            this.replaceBracket(brackFrag, side)
        }

        if (sib) {
            // auto-expand so the ghost is at the far end
            const block = this.getEnd(L)
            const origEnd = block.getEnd(side)
            block.domFrag().removeClass('mq-empty')
            new Fragment(sib, farEnd, opp(side))
                .disown()
                .withDirAdopt(opp(side), block, origEnd, 0)
                .domFrag()
                .insAtDirEnd(side, block.domFrag().oneElement())
            if (origEnd) origEnd.siblingCreated(cursor.options, side)
            cursor.insDirOf(opp(side), sib)
        } else if (outward) {
            // didn't auto-expand: cursor goes just outside or just inside the brackets
            cursor.insDirOf(side, this)
        } else {
            cursor.insAtDirEnd(side, this.getEnd(L))
        }
    }

    /** Redraw the bracket glyph of `side` inside `brackFrag`. */
    replaceBracket(brackFrag: DOMFragment, side: BracketSide): void {
        const symbol = this.getSymbol(side)
        brackFrag.children().replaceWith(domFrag(symbol.html()))
        brackFrag.oneElement().style.width = symbol.width
        const middle = side === L ? brackFrag.next() : brackFrag.prev()
        if (!middle.isEmpty()) {
            if (side === L) middle.oneElement().style.marginLeft = symbol.width
            else middle.oneElement().style.marginRight = symbol.width
        }
    }

    deleteTowards(dir: Direction, cursor: Cursor): void {
        this.deleteSide(opp(dir), false, cursor)
    }

    deleteOutOfBlock(block: MathBlock, dir: Direction, cursor: Cursor): void {
        if (this.finalized) this.deleteSide(dir, true, cursor)
        else super.deleteOutOfBlock(block, dir, cursor)
    }

    finalizeTree(): void {
        // After the initial insertion, finalizeTree is only called again if the
        // bracket is selected and replaced (e.g. by a LiveFraction): solidify then.
        if (this.finalized) this.solidify()
        else this.finalized = true
    }

    intentionalBlur(): void {
        if (this.finalized) this.solidify()
    }

    /** Turn a one-sided bracket into a two-sided one. */
    private solidify(): void {
        this.delimFrags[this.side === L ? R : L].removeClass('mq-ghost')
        this.side = 0
    }

    siblingCreated(_opts: Options, dir: Direction): void {
        // something typed between the ghost and the far end of its block: solidify
        if (dir === -this.side) this.finalizeTree()
    }
}

function oppositeBracketSide(bracket: Bracket): BracketSideInfo {
    const data = bracket.sides[bracket.side as Direction]
    return { ch: OPP_BRACKS[data.ch], ctrlSeq: OPP_BRACKS[data.ctrlSeq] }
}

for (const { open, close, openLatex, closeLatex, typed, openCommand, closeCommand } of config.pairs) {
    const makeLeft = () => new Bracket(L, open, close, openLatex, closeLatex)
    const makeRight = () => new Bracket(R, open, close, openLatex, closeLatex)

    if (typed !== 'none') {
        charCommands.define(open, makeLeft)
        // `typed: open` for `|`, where registering the closer would shadow the opener
        if (typed === 'both') charCommands.define(close, makeRight)
    }
    if (openCommand) latexCommands.define(openCommand, makeLeft)
    if (closeCommand) latexCommands.define(closeCommand, makeRight)
}

type BracketPair = (typeof config.pairs)[number]

/** Delimiters by the token that follows `\left` / `\right` (the control sequence, trimmed). */
const OPEN_BY_TOKEN = new Map<string, BracketPair>()
const CLOSE_BY_TOKEN = new Map<string, BracketPair>()
for (const pair of config.pairs) {
    OPEN_BY_TOKEN.set(pair.openLatex.trim(), pair)
    CLOSE_BY_TOKEN.set(pair.closeLatex.trim(), pair)
}

/** Matches any of `tokens`; a `\word` token must not be followed by a letter. */
function tokenPattern(tokens: Iterable<string>): RegExp {
    const alternatives = [...tokens].map((token) =>
        /^\\[a-zA-Z]+$/.test(token)
            ? token.replace('\\', '\\\\') + '(?![a-zA-Z])'
            : token.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
    )
    return new RegExp('^(?:' + alternatives.join('|') + ')')
}

const OPEN_PATTERN = tokenPattern(OPEN_BY_TOKEN.keys())
const CLOSE_PATTERN = tokenPattern(CLOSE_BY_TOKEN.keys())

/** `\left( ... \right)`; the two sides need not match (`\left[ ... \right)`). */
latexCommands.define(
    'left',
    class extends ParseOnlyCommand {
        parser(): Parser<MQNode | Fragment> {
            const { regex, string, optWhitespace } = Parser
            return optWhitespace
                .then(regex(OPEN_PATTERN))
                .then((openToken) => {
                    const open = OPEN_BY_TOKEN.get(openToken)!
                    return latexMathParser.then((block) =>
                        string('\\right')
                            .skip(optWhitespace)
                            .then(regex(CLOSE_PATTERN))
                            .map((closeToken) => {
                                const close = CLOSE_BY_TOKEN.get(closeToken)!
                                const cmd = new Bracket(0, open.open, close.close, open.openLatex, close.closeLatex)
                                cmd.blocks = [block]
                                block.adopt(cmd, 0, 0)
                                return cmd
                            })
                    )
                })
        }
    }
)

latexCommands.define(
    'right',
    class extends ParseOnlyCommand {
        parser(): Parser<MQNode | Fragment> {
            return Parser.fail('unmatched \\right')
        }
    }
)

const leftParen = SVG_SYMBOLS['(']
const rightParen = SVG_SYMBOLS[')']

/** `\binom{n}{k}` */
class Binomial extends DelimsNode {
    ctrlSeq = '\\binom'
    domView = new DOMView(2, (blocks) =>
        h('span', { class: 'mq-non-leaf mq-bracket-container' }, [
            h('span', { style: 'width:' + leftParen.width, class: 'mq-paren mq-bracket-l mq-scaled' }, [leftParen.html()]),
            h(
                'span',
                {
                    style: 'margin-left:' + leftParen.width + '; margin-right:' + rightParen.width,
                    class: 'mq-non-leaf mq-bracket-middle',
                },
                [
                    h('span', { class: 'mq-array mq-non-leaf' }, [
                        h.block('span', {}, blocks[0]),
                        h.block('span', {}, blocks[1]),
                    ]),
                ]
            ),
            h('span', { style: 'width:' + rightParen.width, class: 'mq-paren mq-bracket-r mq-scaled' }, [rightParen.html()]),
        ])
    )
}

latexCommands.define(['binom', 'binomial'], Binomial)

/** `n \choose k`: typed like `/`, the term on the left becomes the top. */
latexCommands.define(
    'choose',
    class extends Binomial {
        createLeftOf(cursor: Cursor): void {
            takeLeftTermAsFirstBlock(this, cursor)
            super.createLeftOf(cursor)
        }
    }
)
