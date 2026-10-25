/***************************
 * Radicals: \sqrt{x}, \sqrt[n]{x}, \nthroot, \cbrt
 **************************/
import { L, R } from '../../core/direction'
import { h } from '../../core/dom'
import type { Cursor } from '../../tree/cursor'
import { latexCommands } from '../registry'
import { DOMView, MathCommand } from './core'
import { latexMathParser } from './latexParser'
import { SVG_SYMBOLS } from './svgSymbols'
import { Digit } from './symbols'

export class SquareRoot extends MathCommand {
    ctrlSeq = '\\sqrt'
    domView = new DOMView(1, (blocks) =>
        h('span', { class: 'mq-non-leaf mq-sqrt-container' }, [
            h('span', { class: 'mq-scaled mq-sqrt-prefix' }, [SVG_SYMBOLS.sqrt.html()]),
            h.block('span', { class: 'mq-non-leaf mq-sqrt-stem' }, blocks[0]),
        ])
    )

    /** `\sqrt[n]{x}` parses into an NthRoot. */
    parser() {
        return latexMathParser.optBlock
            .then((index) =>
                latexMathParser.block.map((radicand) => {
                    const root = new NthRoot()
                    root.blocks = [index, radicand]
                    index.adopt(root, 0, 0)
                    radicand.adopt(root, index, 0)
                    return root
                })
            )
            .or(super.parser())
    }
}

export class NthRoot extends SquareRoot {
    domView = new DOMView(2, (blocks) =>
        h('span', { class: 'mq-nthroot-container mq-non-leaf' }, [
            h.block('sup', { class: 'mq-nthroot mq-non-leaf' }, blocks[0]),
            h('span', { class: 'mq-scaled mq-sqrt-container' }, [
                h('span', { class: 'mq-sqrt-prefix mq-scaled' }, [SVG_SYMBOLS.sqrt.html()]),
                h.block('span', { class: 'mq-sqrt-stem mq-non-leaf' }, blocks[1]),
            ]),
        ])
    )

    latex(): string {
        return '\\sqrt[' + this.getEnd(L).latex() + ']{' + this.getEnd(R).latex() + '}'
    }
}

/** Cube root: an NthRoot typed with index 3, cursor in the radicand. */
class CubeRoot extends NthRoot {
    createLeftOf(cursor: Cursor): void {
        super.createLeftOf(cursor)
        new Digit('3').createLeftOf(cursor)
        cursor.controller.editor.moveRight()
    }
}

latexCommands.define('sqrt', SquareRoot)
latexCommands.define('nthroot', NthRoot)
latexCommands.define('cbrt', CubeRoot)
