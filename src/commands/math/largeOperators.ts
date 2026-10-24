/***************************
 * Large operators with limits: \sum, \prod, \coprod, \int
 **************************/
import { L, R } from '../../core/direction'
import { U_INTEGRAL, U_NARY_COPRODUCT, U_NARY_PRODUCT, U_NARY_SUMMATION, U_ZERO_WIDTH_SPACE } from '../../core/unicode'
import { h } from '../../core/dom'
import { Parser } from '../../core/parser'
import type { Cursor } from '../../tree/cursor'
import type { MQNode } from '../../tree/node'
import type { Fragment } from '../../tree/fragment'
import { basicNodes, latexCommands } from '../registry'
import { DOMView, MathBlock, MathCommand } from './core'
import { latexMathParser } from './latexParser'

/** Big operator with a lower (block 0) and upper (block 1) limit. */
export class SummationNotation extends MathCommand {
    constructor(ctrlSeq: string, symbol: string) {
        super(
            ctrlSeq,
            new DOMView(2, (blocks) =>
                h('span', { class: 'mq-large-operator mq-non-leaf' }, [
                    h('span', { class: 'mq-to' }, [h.block('span', {}, blocks[1])]),
                    h('big', {}, [h.text(symbol)]),
                    h('span', { class: 'mq-from' }, [h.block('span', {}, blocks[0])]),
                ])
            )
        )
    }

    createLeftOf(cursor: Cursor): void {
        super.createLeftOf(cursor)
        if (cursor.options.sumStartsWithNEquals) {
            basicNodes.letter('n').createLeftOf(cursor)
            latexCommands.create('=')?.createLeftOf(cursor)
        }
    }

    latex(): string {
        const simplify = (latex: string) => '{' + (latex || ' ') + '}'
        return this.ctrlSeq + '_' + simplify(this.getEnd(L).latex()) + '^' + simplify(this.getEnd(R).latex())
    }

    text(): string {
        const name = (this.ctrlSeq || '').replace(/^\\/, '').trim()
        return name + '_(' + this.getEnd(L).text() + ')^(' + this.getEnd(R).text() + ')'
    }

    /** Limits are optional and may come in either order: `\sum^{n}_{i=0}`. */
    parser(): Parser<MQNode | Fragment> {
        const blocks = (this.blocks = [new MathBlock(), new MathBlock()])
        for (const block of blocks) block.adopt(this, this.getEnd(R), 0)

        return Parser.optWhitespace
            .then(Parser.string('_').or(Parser.string('^')))
            .then((supOrSub) => {
                const child = blocks[supOrSub === '_' ? 0 : 1]
                return latexMathParser.block.map((block) => {
                    block.children().adopt(child, child.getEnd(R), 0)
                    return this
                })
            })
            .many()
            .result(this)
    }

    finalizeTree(): void {
        const from = this.getEnd(L)
        const to = this.getEnd(R)
        this.downInto = from
        this.upInto = to
        from.upOutOf = to
        to.downOutOf = from
    }
}

latexCommands.define(['∑', 'sum', 'summation'], () => new SummationNotation('\\sum ', U_NARY_SUMMATION))
latexCommands.define(['∏', 'prod', 'product'], () => new SummationNotation('\\prod ', U_NARY_PRODUCT))
latexCommands.define(['coprod', 'coproduct'], () => new SummationNotation('\\coprod ', U_NARY_COPRODUCT))

class Integral extends SummationNotation {
    constructor() {
        super('\\int ', '')
        this.domView = new DOMView(2, (blocks) =>
            h('span', { class: 'mq-int mq-non-leaf' }, [
                h('big', {}, [h.text(U_INTEGRAL)]),
                h('span', { class: 'mq-supsub mq-non-leaf' }, [
                    h('span', { class: 'mq-sup' }, [h.block('span', { class: 'mq-sup-inner' }, blocks[1])]),
                    h.block('span', { class: 'mq-sub' }, blocks[0]),
                    h('span', { style: 'display:inline-block;width:0' }, [h.text(U_ZERO_WIDTH_SPACE)]),
                ]),
            ])
        )
    }

    /** Unlike sums, integrals never start with `n=`. */
    createLeftOf(cursor: Cursor): void {
        MathCommand.prototype.createLeftOf.call(this, cursor)
    }
}

latexCommands.define(['∫', 'int', 'integral'], Integral)
