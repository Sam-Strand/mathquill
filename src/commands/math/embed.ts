/**
 * `\embed{name}[data]`: arbitrary content registered with
 * `MathQuill.registerEmbed(name, fn)`. Behaves like a symbol: the cursor
 * goes around it, never into it.
 */
import { h, parseHTML } from '../../core/dom'
import { Parser } from '../../core/parser'
import type { EmbedOptions } from '../../public/types'
import type { Cursor } from '../../tree/cursor'
import { embeds, latexCommands } from '../registry'
import { DOMView, MQSymbol } from './core'

export class EmbedNode extends MQSymbol {
    private options: EmbedOptions = {}

    setOptions(options: EmbedOptions): this {
        this.options = options
        this.domView = new DOMView(0, () => h('span', {}, [parseHTML(options.htmlString || '')]))
        return this
    }

    /** `\embed` typed without a registered embed inserts nothing. */
    createLeftOf(cursor: Cursor): void {
        if (this.domView) super.createLeftOf(cursor)
    }

    latex(): string {
        return this.options.latex ? this.options.latex() : ''
    }

    parser() {
        const { string, regex, succeed, fail } = Parser
        return string('{')
            .then(regex(/^[a-z][a-z0-9]*/i))
            .skip(string('}'))
            .then((name) =>
                // the optional data may contain anything except braces and brackets
                string('[')
                    .then(regex(/^[-\w\s]*/))
                    .skip(string(']'))
                    .or(succeed(undefined))
                    .then((data) => {
                        const embed = embeds.get(name)
                        return embed ? succeed(this.setOptions(embed(data))) : fail('unknown embed: ' + name)
                    })
            )
    }
}

latexCommands.define('embed', EmbedNode)
