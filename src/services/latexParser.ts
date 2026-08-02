import type { LatexCmdsSingleChar } from '../shared_types'
import { Fragment, LatexCmds, MQNode, isMQNodeClass } from '../tree'
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
        var block = new MathBlock()
        cmd.adopt(block, 0, 0)
        return block
    }
    function joinBlocks(blocks: MathBlock[]) {
        var firstBlock = blocks[0] || new MathBlock()
        for (var i = 1; i < blocks.length; i += 1) {
            blocks[i].children().adopt(firstBlock, firstBlock.getEnd(R), 0)
        }
        return firstBlock
    }

    var string = Parser.string
    var regex = Parser.regex
    var letter = Parser.letter
    var digit = Parser.digit
    var any = Parser.any
    var optWhitespace = Parser.optWhitespace
    var succeed = Parser.succeed
    var fail = Parser.fail

    var variable = letter.map(function (c) { return new Letter(c) })
    var number = digit.map(function (c) { return new Digit(c) })
    var symbol = regex(/^[^${}\\_^]/).map(function (c) { return new VanillaSymbol(c) })

    var controlSequence = regex(/^[^\\a-eg-zA-Z]/)
        .or(
            string('\\').then(
                regex(/^[a-z]+/i).or(regex(/^\s+/).result(' ')).or(any)
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

    var command = controlSequence.or(variable).or(number).or(symbol)

    var mathGroup: Parser<MathBlock> = string('{').then(function () { return mathSequence }).skip(string('}'))
    var mathBlock = optWhitespace.then(mathGroup.or(command.map(commandToBlock)))
    var mathSequence = mathBlock.many().map(joinBlocks).skip(optWhitespace)

    var optMathBlock = string('[').then(
        mathBlock.then(function (block) {
            return block.join('latex') !== ']' ? succeed(block) : fail('')
        }).many().map(joinBlocks).skip(optWhitespace)
    ).skip(string(']'))

    var latexMath: typeof mathSequence & { block: typeof mathBlock; optBlock: typeof optMathBlock } = mathSequence as any
    latexMath.block = mathBlock
    latexMath.optBlock = optMathBlock
    return latexMath
})()
