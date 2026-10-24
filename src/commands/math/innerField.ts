/**
 * `\MathQuillMathField[name]{...}`: an editable field inside static math.
 * Its block is the root of a nested controller.
 */
import { L } from '../../core/direction'
import { h } from '../../core/dom'
import { Parser } from '../../core/parser'
import type { MQNode, InnerFieldCollector } from '../../tree/node'
import type { Fragment } from '../../tree/fragment'
import type { Options } from '../../options'
import { Controller } from '../../controller/Controller'
import { latexCommands } from '../registry'
import { DOMView, MathCommand, RootMathBlock, type MathBlock } from './core'

class InnerMathFieldNode extends MathCommand {
    ctrlSeq = '\\MathQuillMathField'
    name: string | undefined
    domView = new DOMView(1, (blocks) =>
        h('span', { class: 'mq-editable-field' }, [h.block('span', { class: 'mq-root-block' }, blocks[0])])
    )
    private controller: Controller | undefined

    protected newBlock(): MathBlock {
        return new RootMathBlock()
    }

    parser(): Parser<MQNode | Fragment> {
        const { string, regex, succeed } = Parser
        return string('[')
            .then(regex(/^[a-z][a-z0-9]*/i))
            .skip(string(']'))
            .map((name) => {
                this.name = name
            })
            .or(succeed(undefined))
            .then(super.parser())
            .map((node) => {
                // the parsed block becomes the root block of the inner field
                const parsed = this.getEnd(L) as MathBlock
                const root = new RootMathBlock()
                parsed.children().disown().adopt(root, 0, 0)
                parsed.disown()
                root.adopt(this, 0, 0)
                this.blocks = [root]
                return node
            })
    }

    finalizeTree(options: Options): void {
        const root = this.getEnd(L) as RootMathBlock
        const ctrlr = (this.controller = new Controller(root, this.domFrag().oneElement(), options))
        ctrlr.mountInner()
    }

    registerInnerField(collector: InnerFieldCollector): void {
        if (this.controller) collector.add(this.name, this.controller)
    }

    latex(): string {
        return this.getEnd(L).latex()
    }

    text(): string {
        return this.getEnd(L).text()
    }
}

latexCommands.define(['editable', 'MathQuillMathField'], InnerMathFieldNode)
