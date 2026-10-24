/***************************
 * Commands that style their single block: fonts, over/underlines,
 * accents and colors.
 **************************/
import { L } from '../../core/direction'
import { U_DOT_ABOVE } from '../../core/unicode'
import { h, type HTMLTagName } from '../../core/dom'
import { Parser } from '../../core/parser'
import { latexCommands } from '../registry'
import { DOMView, MathCommand } from './core'

/** A one-block command rendered as `<tag attrs>block</tag>`. */
export class Style extends MathCommand {
    constructor(ctrlSeq: string, tagName: HTMLTagName, attrs: { class: string }) {
        super(ctrlSeq, new DOMView(1, (blocks) => h.block(tagName, attrs, blocks[0])))
    }
}

function defineStyle(names: string | string[], ctrlSeq: string, tagName: HTMLTagName, cls: string): void {
    latexCommands.define(names, () => new Style(ctrlSeq, tagName, { class: cls }))
}

// fonts
defineStyle('mathrm', '\\mathrm', 'span', 'mq-roman mq-font')
defineStyle('mathit', '\\mathit', 'i', 'mq-font')
defineStyle('mathbf', '\\mathbf', 'b', 'mq-font')
defineStyle('mathsf', '\\mathsf', 'span', 'mq-sans-serif mq-font')
defineStyle('mathtt', '\\mathtt', 'span', 'mq-monospace mq-font')

// text decoration
defineStyle('underline', '\\underline', 'span', 'mq-non-leaf mq-underline')
defineStyle(['overline', 'bar'], '\\overline', 'span', 'mq-non-leaf mq-overline')
defineStyle('overrightarrow', '\\overrightarrow', 'span', 'mq-non-leaf mq-overarrow mq-arrow-right')
defineStyle('overleftarrow', '\\overleftarrow', 'span', 'mq-non-leaf mq-overarrow mq-arrow-left')
defineStyle('overleftrightarrow', '\\overleftrightarrow ', 'span', 'mq-non-leaf mq-overarrow mq-arrow-leftright')
defineStyle('overarc', '\\overarc', 'span', 'mq-non-leaf mq-overarc')

/** `\dot{3}`: recurring decimal dot */
latexCommands.define(
    'dot',
    () =>
        new MathCommand(
            '\\dot',
            new DOMView(1, (blocks) =>
                h('span', { class: 'mq-non-leaf' }, [
                    h('span', { class: 'mq-dot-recurring-inner' }, [
                        h('span', { class: 'mq-dot-recurring' }, [h.text(U_DOT_ABOVE)]),
                        h.block('span', { class: 'mq-empty-box' }, blocks[0]),
                    ]),
                ])
            ),
            ['dot(', ')']
        )
)

latexCommands.define(
    'hat',
    () =>
        new MathCommand(
            '\\hat',
            new DOMView(1, (blocks) =>
                h('span', { class: 'mq-non-leaf' }, [
                    h('span', { class: 'mq-hat-prefix' }, [h.text('^')]),
                    h.block('span', { class: 'mq-hat-stem' }, blocks[0]),
                ])
            ),
            ['hat(', ')']
        )
)

/** An accent drawn above the block (`\vec`, `\tilde`). */
class DiacriticAbove extends MathCommand {
    constructor(ctrlSeq: string, accent: Node, name: string) {
        super(
            ctrlSeq,
            new DOMView(1, (blocks) =>
                h('span', { class: 'mq-non-leaf' }, [
                    h('span', { class: 'mq-diacritic-above' }, [accent.cloneNode(true)]),
                    h.block('span', { class: 'mq-diacritic-stem' }, blocks[0]),
                ])
            ),
            [name + '(', ')']
        )
    }
}
latexCommands.define('vec', () => new DiacriticAbove('\\vec', h.entityText('&rarr;'), 'vec'))
latexCommands.define('tilde', () => new DiacriticAbove('\\tilde', h.text('~'), 'tilde'))

/**
 * `\textcolor{color}{math}` colors its content; `color` is any CSS color.
 * Style blocks are transparent for deciding whether +/- are binary.
 */
class TextColor extends MathCommand {
    color: string | undefined
    domView = new DOMView(1, (blocks) =>
        h.block('span', { class: 'mq-textcolor', style: this.color ? 'color:' + this.color : undefined }, blocks[0])
    )

    latex(): string {
        const content = this.getEnd(L).latex()
        return this.color === undefined ? content : '\\textcolor{' + this.color + '}{' + content + '}'
    }

    parser() {
        return Parser.optWhitespace
            .then(Parser.string('{'))
            .then(Parser.regex(/^[#\w\s.,()%-]*/))
            .skip(Parser.string('}'))
            .then((color) => {
                this.color = color
                return super.parser()
            })
    }

    isStyleBlock(): boolean {
        return true
    }
}
latexCommands.define('textcolor', TextColor)
