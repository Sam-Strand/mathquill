import type { LatexCmdsSingleChar } from '../shared_types'

import { LatexCmds } from '../registry'
import { Fragment, MQNode, isMQNodeClass } from '../tree'
import { R } from '../types'
import { VanillaSymbol, MathBlock } from '../commands/math/core'
import { Parser } from '../services/parser.util'

let Letter: any
let Digit: any

export function setLatexParserNodeConstructors(constructors: { Letter: any; Digit: any }) {
    Letter = constructors.Letter
    Digit = constructors.Digit
}

export class TempSingleCharNode extends MQNode {
    constructor(_char: string) {
        super()
    }
}

export const latexMathParser = (function () {
    function commandToBlock(cmd: MQNode | Fragment): MathBlock {
        const block = new MathBlock()
        cmd.adopt(block, 0, 0)
        return block
    }
    function joinBlocks(blocks: MathBlock[]) {
        const firstBlock = blocks[0] || new MathBlock()
        for (var i = 1; i < blocks.length; i += 1) {
            blocks[i].children().adopt(firstBlock, firstBlock.getEnd(R), 0)
        }
        return firstBlock
    }

    const string = Parser.string
    const regex = Parser.regex
    const optWhitespace = Parser.optWhitespace
    const fail = Parser.fail

    const variable = Parser.letter.map((c) => { return new Letter(c) })
    const number = Parser.digit.map((c) => { return new Digit(c) })
    const symbol = regex(/^[^${}\\_^]/).map((c) => { return new VanillaSymbol(c) })

    const controlSequence = regex(/^[^\\a-eg-zA-Z]/)
        .or(
            string('\\').then(
                regex(/^[a-z]+/i).or(regex(/^\s+/).result(' ')).or(Parser.any)
            )
        )
        .then(function (ctrlSeq) {
            var cmdKlass = (LatexCmds as LatexCmdsSingleChar)[ctrlSeq]
            if (cmdKlass) {
                if (isMQNodeClass(cmdKlass)) {
                    return new (cmdKlass as typeof TempSingleCharNode)(ctrlSeq).parser()
                }
                return (cmdKlass as (c: string) => TempSingleCharNode)(ctrlSeq).parser()
            }
            return fail('unknown command: \\' + ctrlSeq)
        })

    const command = controlSequence.or(variable).or(number).or(symbol)

    const mathGroup: Parser<MathBlock> = string('{').then(function () { return mathSequence }).skip(string('}'))
    const mathBlock = optWhitespace.then(mathGroup.or(command.map(commandToBlock)))
    const mathSequence = mathBlock.many().map(joinBlocks).skip(optWhitespace)

    const optMathBlock = string('[').then(
        mathBlock.then(function (block) {
            return block.join('latex') !== ']' ? Parser.succeed(block) : fail('')
        }).many().map(joinBlocks).skip(optWhitespace)
    ).skip(string(']'))

    const latexMath: typeof mathSequence & { block: typeof mathBlock; optBlock: typeof optMathBlock } = mathSequence as any
    latexMath.block = mathBlock
    latexMath.optBlock = optMathBlock
    return latexMath
})()
