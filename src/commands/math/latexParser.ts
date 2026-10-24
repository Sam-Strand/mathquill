/**
 * The LaTeX grammar for math mode.
 *
 *   mathSequence := mathBlock* whitespace?
 *   mathBlock    := whitespace? ( '{' mathSequence '}' | command )
 *   command      := '\' name (+ the command's own parser) | letter | digit | symbol
 *
 * Commands parse their own arguments (`MQNode.parser()`), usually by calling
 * back into `latexMathParser.block`.
 */
import { R } from '../../core/direction'
import { Parser } from '../../core/parser'
import type { Fragment } from '../../tree/fragment'
import type { MQNode } from '../../tree/node'
import { basicNodes, latexCommands } from '../registry'
import { MathBlock, VanillaSymbol } from './core'

function commandToBlock(cmd: MQNode | Fragment): MathBlock {
    const block = new MathBlock()
    cmd.adopt(block, 0, 0)
    return block
}

function joinBlocks(blocks: MathBlock[]): MathBlock {
    const first = blocks[0] || new MathBlock()
    for (let i = 1; i < blocks.length; i += 1) blocks[i].children().adopt(first, first.getEnd(R), 0)
    return first
}

type LatexMathParser = Parser<MathBlock> & {
    /** a single `{...}` group or command, as a block */
    block: Parser<MathBlock>
    /** an optional `[...]` argument, as a block */
    optBlock: Parser<MathBlock>
}

function buildLatexMathParser(): LatexMathParser {
    const { string, regex, optWhitespace, fail } = Parser

    const variable = Parser.letter.map((c) => basicNodes.letter(c))
    const number = Parser.digit.map((c) => basicNodes.digit(c))
    const symbol = regex(/^[^${}\\_^]/).map((c) => new VanillaSymbol(c))

    const controlSequence = regex(/^[^\\a-eg-zA-Z]/)
        .or(string('\\').then(regex(/^[a-z]+/i).or(regex(/^\s+/).result(' ')).or(Parser.any)))
        .then((ctrlSeq): Parser<MQNode | Fragment> => {
            const cmd = latexCommands.create(ctrlSeq)
            return cmd ? cmd.parser() : fail('unknown command: \\' + ctrlSeq)
        })

    const command = controlSequence.or(variable).or(number).or(symbol)

    // `mathSequence` is referenced lazily because the grammar is recursive
    // eslint-disable-next-line prefer-const
    let mathSequence: Parser<MathBlock>
    const mathGroup: Parser<MathBlock> = string('{')
        .then(() => mathSequence)
        .skip(string('}'))
    const mathBlock = optWhitespace.then(mathGroup.or(command.map(commandToBlock)))
    mathSequence = mathBlock.many().map(joinBlocks).skip(optWhitespace)

    const optMathBlock = string('[')
        .then(
            mathBlock
                .then((block) => (block.join('latex') !== ']' ? Parser.succeed(block) : fail('')))
                .many()
                .map(joinBlocks)
                .skip(optWhitespace)
        )
        .skip(string(']'))

    return Object.assign(mathSequence, { block: mathBlock, optBlock: optMathBlock })
}

/** The math-mode LaTeX parser. Command lookups happen at parse time, so later registrations are honoured. */
export const latexMathParser: LatexMathParser = buildLatexMathParser()
