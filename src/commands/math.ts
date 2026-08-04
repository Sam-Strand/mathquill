import type { NodeRef, LatexCmdsSingleCharBuilder, CharCmdsAny, LatexCmdsAny } from '../shared_types'
import type { MQNode, Fragment } from '../tree'

import { isMQNodeClass } from '../tree'
import { LatexCmds, CharCmds } from '../registry'
import { L, R } from '../types'
import { domFrag } from '../domFragment'
import { RootBlockMixin } from '../mixins'
import { Options } from '../options'
import { Cursor } from '../cursor'
import { Parser } from '../services/parser.util'
import { latexMathParser } from '../services/latexParser'
import { Letter, Digit } from './math/basicSymbols'
import { MathBlock, RootMathBlock, MathCommand, VanillaSymbol } from './math/core'

MathBlock.prototype.chToCmd = function (ch: string, options: Options) {
    if (ch.match(/^[a-eg-zA-Z]$/)) return new Letter(ch)
    if (/^\d$/.test(ch)) return new Digit(ch)

    const specialHandlers: Record<string, (ch: string) => MQNode | undefined> = {
        '/': (ch) => options?.typingSlashWritesDivisionSymbol 
            ? (LatexCmds as LatexCmdsSingleCharBuilder)['÷'](ch) 
            : undefined,
        '*': (ch) => options?.typingAsteriskWritesTimesSymbol
            ? (LatexCmds as LatexCmdsSingleCharBuilder)['×'](ch)
            : undefined,
        '%': (ch) => options?.typingPercentWritesPercentOf
            ? (LatexCmds as LatexCmdsSingleCharBuilder).percentof(ch)
            : undefined
    }

    const specialResult = specialHandlers[ch]?.(ch)
    if (specialResult) return specialResult

    const commandClass = (CharCmds as CharCmdsAny)[ch] || (LatexCmds as LatexCmdsAny)[ch]
    if (commandClass) {
        return isMQNodeClass(commandClass)
            ? new (commandClass as any)(ch)
            : commandClass(ch)
    }

    return new VanillaSymbol(ch)
}

MathBlock.prototype.write = function (cursor: Cursor, ch: string) {
    const cmd = this.chToCmd(ch, cursor.options)
    if (cursor.selection) cmd.replaces(cursor.replaceSelection())
    if (!cursor.isTooDeep()) {
        cmd.createLeftOf(cursor.show())
    }
}

MathBlock.prototype.writeLatex = function (cursor: Cursor, latex: string) {
    const block = latexMathParser
        .skip(Parser.eof)
        .or(Parser.all.result<false>(false))
        .parse(latex)

    if (block && !block.isEmpty() && block.prepareInsertionAt(cursor)) {
        block
            .children()
            .adopt(cursor.parent, cursor[L] as NodeRef, cursor[R] as NodeRef); // TODO - masking undefined. should be 0
        domFrag(block.html()).insertBefore(cursor.domFrag())
        cursor[L] = block.getEnd(R)
        block.finalizeInsert(cursor.options, cursor)
        var blockEndsR = block.getEnd(R)
        var blockEndsL = block.getEnd(L)
        var blockEndsRR = (blockEndsR as MQNode)[R]
        var blockEndsLL = (blockEndsL as MQNode)[L]
        if (blockEndsRR) blockEndsRR.siblingCreated(cursor.options, L)
        if (blockEndsLL) blockEndsLL.siblingCreated(cursor.options, R)
        cursor.parent.bubble(function (node) {
            node.reflow()
            return undefined
        })
    }
}

MathCommand.prototype.parser = function (this: MathCommand): Parser<MQNode | Fragment> {
    return latexMathParser.block.times(this.numBlocks()).map((blocks) => {
        this.blocks = blocks
        for (var i = 0; i < blocks.length; i += 1) {
            blocks[i].adopt(this, this.getEnd(R), 0)
        }
        return this
    })
}

RootBlockMixin(RootMathBlock.prototype) // adds methods to RootMathBlock

export {
    MathBlock,
    RootMathBlock
}
