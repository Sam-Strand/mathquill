/***************************
 * Fractions. Typing `/` creates a "live" fraction that takes the preceding
 * term as its numerator.
 **************************/
import { L, R } from '../../core/direction'
import { U_ZERO_WIDTH_SPACE } from '../../core/unicode'
import { h } from '../../core/dom'
import { Fragment } from '../../tree/fragment'
import type { MQNode } from '../../tree/node'
import type { Cursor } from '../../tree/cursor'
import { charCommands, latexCommands } from '../registry'
import { BinaryOperator, DOMView, MathCommand } from './core'
import { SupSub } from './supsub'
import { SummationNotation } from './largeOperators'
import { TextBlock } from '../text'

export class Fraction extends MathCommand {
    ctrlSeq = '\\frac'
    domView = new DOMView(2, (blocks) =>
        h('span', { class: 'mq-fraction mq-non-leaf' }, [
            h.block('span', { class: 'mq-numerator' }, blocks[0]),
            h.block('span', { class: 'mq-denominator' }, blocks[1]),
            h('span', { style: 'display:inline-block;width:0' }, [h.text(U_ZERO_WIDTH_SPACE)]),
        ])
    )

    finalizeTree(): void {
        const numerator = this.getEnd(L)
        const denominator = this.getEnd(R)
        this.upInto = denominator.upOutOf = numerator
        this.downInto = numerator.downOutOf = denominator
    }
}

latexCommands.define(['frac', 'dfrac', 'cfrac', 'fraction'], Fraction)

/** Is `node` the boundary of the numerator a typed `/` would take? */
function endsNumerator(node: MQNode): boolean {
    return (
        node instanceof BinaryOperator ||
        node instanceof TextBlock ||
        node instanceof SummationNotation ||
        node.ctrlSeq === '\\ ' ||
        /^[,;:]$/.test(node.ctrlSeq || '')
    )
}

/**
 * Make the term left of the cursor (back to the previous operator) the
 * first block of `cmd`, as typing `/` does for fractions.
 */
export function takeLeftTermAsFirstBlock(cmd: MathCommand, cursor: Cursor): void {
    if (cmd.replacedFragment) return
    let leftward = cursor[L]
    if (!cursor.options.typingSlashCreatesNewFraction) {
        while (leftward && !endsNumerator(leftward)) leftward = leftward[L]
    }
    // `\sum_a^b` followed by its SupSub: take both
    if (leftward instanceof SummationNotation && leftward[R] instanceof SupSub) {
        leftward = leftward[R] as MQNode
        const next = leftward[R]
        if (next instanceof SupSub && next.ctrlSeq != leftward.ctrlSeq) leftward = next
    }
    if (leftward !== cursor[L] && !cursor.isTooDeep(1)) {
        const first = (leftward && leftward[R]) || cursor.parent.getEnd(L)
        cmd.replaces(new Fragment(first, cursor[L]))
        cursor[L] = leftward
    }
}

/** Fraction created by typing `/`: the term left of the cursor becomes the numerator. */
export class LiveFraction extends Fraction {
    createLeftOf(cursor: Cursor): void {
        takeLeftTermAsFirstBlock(this, cursor)
        super.createLeftOf(cursor)
    }
}

latexCommands.define('over', LiveFraction)
charCommands.define('/', LiveFraction)
