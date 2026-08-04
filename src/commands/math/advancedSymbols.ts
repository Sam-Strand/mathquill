/************************************
 * Symbols for Advanced Mathematics
 ***********************************/

import type { MQNodeBuilderNoParam } from '../../shared_types'

import { isMQNodeClass } from '../../tree'
import { LatexCmds } from '../../registry'
import { MathCommand, bindVanillaSymbol, bindBinaryOperator, BinaryOperator } from '../../commands/math/core'
import { Cursor } from '../../cursor'
import { Parser } from '../../services/parser.util'
import { h } from '../../dom'


type SymbolDefinition = {
    aliases: string[]
    latex: string
    html: string
}

import config from './symbols-config.json'


const registerSymbols = (definitions: SymbolDefinition[], type: string): void => {
    definitions.forEach(({ aliases, latex, html }) => {
        const binder = type === 'binary' ? bindBinaryOperator : bindVanillaSymbol
        const symbol = binder(latex, html)
        
        aliases.forEach((alias) => {
            LatexCmds[alias] = symbol
        })
    })
}

const registerDynamicOperators = (): void => {
    const dynamicOperators = ['notin', 'cong', 'equiv', 'oplus', 'otimes']
    const binder = (latex: string) => 
        new BinaryOperator('\\' + latex + ' ', h.entityText('&' + latex + ';'))
    
    dynamicOperators.forEach(op => {
        LatexCmds[op] = binder(op)
    })
}

// Register all symbols
registerSymbols(config.binarySymbols, 'binary')
registerSymbols(config.vanillaSymbols, 'vanilla')
registerDynamicOperators()

/**
 * \mathbb{} command - handles single-letter blackboard bold
 */
LatexCmds.mathbb = class extends MathCommand {
    createLeftOf(_cursor: Cursor) {}
    
    numBlocks() {
        return 1 as const
    }
    
    parser() {
        const { string, regex, optWhitespace } = Parser;
        
        return optWhitespace
            .then(string('{'))
            .then(optWhitespace)
            .then(regex(/^[NPZQRCH]/))
            .skip(optWhitespace)
            .skip(string('}'))
            .map((c: string) => {
                const cmd = LatexCmds[c]
                if (isMQNodeClass(cmd)) {
                    return new cmd()
                } else {
                    return (cmd as MQNodeBuilderNoParam)()
                }
            })
    }
}
