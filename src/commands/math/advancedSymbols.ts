/************************************
 * Symbols for advanced mathematics (set theory, logic, arrows, ...),
 * mostly defined as data in symbols-config.mkon.
 ***********************************/
import { h } from '../../core/dom'
import { Parser } from '../../core/parser'
import type { MQNode } from '../../tree/node'
import { latexCommands } from '../registry'
import { BinaryOperator, ParseOnlyCommand, bindBinaryOperator, bindVanillaSymbol } from './core'
import config from './symbols-config.mkon'

for (const { aliases, latex, html } of config.binarySymbols) {
    latexCommands.define(aliases, bindBinaryOperator(latex, html))
}
for (const { aliases, latex, html } of config.vanillaSymbols) {
    latexCommands.define(aliases, bindVanillaSymbol(latex, html))
}

// operators whose HTML entity is named like the command
latexCommands.define(['notin', 'cong', 'equiv', 'oplus', 'otimes'], (name) => new BinaryOperator('\\' + name + ' ', h.entityText('&' + name + ';')))

/** `\mathbb{R}` etc.: blackboard bold for single capital letters */
latexCommands.define(
    'mathbb',
    class extends ParseOnlyCommand {
        parser() {
            const { string, regex, optWhitespace } = Parser
            return optWhitespace
                .then(string('{'))
                .then(optWhitespace)
                .then(regex(/^[NPZQRCH]/))
                .skip(optWhitespace)
                .skip(string('}'))
                .map((c): MQNode => latexCommands.create(c)!)
        }
    }
)
