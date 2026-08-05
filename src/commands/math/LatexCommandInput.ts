/****************************************
 * Input box to type backslash commands
 ***************************************/
import { Fragment, isMQNodeClass, MQNode } from '../../tree'
import { LatexCmds, CharCmds } from '../../registry'
import { L, R } from '../../types'
import { h } from '../../dom'
import { DOMView, MathCommand, VanillaSymbol } from '../../commands/math/core'
import { Cursor } from '../../cursor'
import { TextBlock } from '../../commands/text'
import { TempSingleCharNode } from '../../services/latex'

CharCmds['\\'] = class LatexCommandInput extends MathCommand {
    ctrlSeq = '\\'
    _replacedFragment?: Fragment

    replaces(replacedFragment: Fragment) {
        this._replacedFragment = replacedFragment.disown()
        this.isEmpty = function () {
            return false
        }
    }
    domView = new DOMView(1, (blocks) =>
        h('span', { class: 'mq-latex-command-input-wrapper mq-non-leaf' }, [
            h('span', { class: 'mq-latex-command-input mq-non-leaf' }, [
                h.text('\\'),
                h.block('span', {}, blocks[0]),
            ]),
        ])
    )
    createBlocks() {
        super.createBlocks()
        const endsL = this.getEnd(L)

        endsL.focus = function () {
            this.parent.domFrag().addClass('mq-hasCursor')
            if (this.isEmpty()) this.parent.domFrag().removeClass('mq-empty')

            return this
        }
        endsL.blur = function () {
            this.parent.domFrag().removeClass('mq-hasCursor')
            if (this.isEmpty()) this.parent.domFrag().addClass('mq-empty')

            return this
        }
        endsL.write = function (cursor, ch) {
            cursor.show().deleteSelection()

            if (ch.match(/[a-z]/i)) {
                new VanillaSymbol(ch).createLeftOf(cursor)
            } else {
                if (ch !== '\\' || !this.isEmpty()) cursor.parent.write(cursor, ch)

            }
        }

        var originalKeystroke = endsL.keystroke
        endsL.keystroke = function (key, e, ctrlr) {
            if (key === 'Tab' || key === 'Enter' || key === 'Spacebar') {
                (this.parent as LatexCommandInput).renderCommand(
                    ctrlr.cursor
                )
                e?.preventDefault()
                return
            }

            return originalKeystroke.call(this, key, e, ctrlr)
        }
    }
    createLeftOf(cursor: Cursor) {
        super.createLeftOf(cursor)

        if (this._replacedFragment) {
            const frag = this.domFrag()
            const el = frag.oneElement()
            this._replacedFragment.domFrag().addClass('mq-blur')

            //FIXME: is monkey-patching the mousedown and mousemove handlers the right way to do this?
            const rewriteMousedownEventTarget = (e: MouseEvent) => {
                {
                    // TODO - overwritting e.target
                    (e as any).target = el
                    el.dispatchEvent(e)
                    return false
                }
            }

            el.addEventListener('mousedown', rewriteMousedownEventTarget)
            el.addEventListener('mouseup', rewriteMousedownEventTarget)

            this._replacedFragment.domFrag().insertBefore(frag.children().first())
        }
    }
    latex() {
        return '\\' + this.getEnd(L).latex() + ' '
    }
    renderCommand(cursor: Cursor) {
        this.setDOM(this.domFrag().children().lastElement())
        this.remove()
        if (this[R]) {
            cursor.insLeftOf(this[R] as MQNode)
        } else {
            cursor.insAtRightEnd(this.parent)
        }

        var latex = this.getEnd(L).latex()
        if (!latex) latex = ' '
        var cmd = LatexCmds[latex]

        if (cmd) {
            let node: MQNode
            if (isMQNodeClass(cmd)) {
                node = new (cmd as typeof TempSingleCharNode)(latex)
            } else {
                node = cmd(latex)
            }
            if (this._replacedFragment)
                (node as MathCommand).replaces(this._replacedFragment)
            node.createLeftOf(cursor)
            return node
        } else {
            const node = new TextBlock()
            node.replaces(latex)
            node.createLeftOf(cursor)
            cursor.insRightOf(node)
            if (this._replacedFragment) {
                this._replacedFragment.remove()
            }
            return node
        }
    }
}
