/****************************************
 * Typing `\` opens a box to type a command name; Tab, Enter, Space or a
 * non-letter renders the command (or a \text block for unknown names).
 ***************************************/
import { L, R } from '../core/direction'
import { h } from '../core/dom'
import type { Fragment } from '../tree/fragment'
import type { MQNode } from '../tree/node'
import type { Cursor } from '../tree/cursor'
import type { Controller } from '../controller/Controller'
import { charCommands, latexCommands } from './registry'
import { DOMView, MathBlock, MathCommand, VanillaSymbol } from './math/core'
import { TextBlock } from './text'

/** The block holding the command name being typed. */
class CommandNameBlock extends MathBlock {
    private get input(): LatexCommandInput {
        return this.parent as LatexCommandInput
    }

    focus(): void {
        this.parent.domFrag().addClass('mq-hasCursor')
        if (this.isEmpty()) this.parent.domFrag().removeClass('mq-empty')
    }

    blur(): void {
        this.parent.domFrag().removeClass('mq-hasCursor')
        if (this.isEmpty()) this.parent.domFrag().addClass('mq-empty')
    }

    write(cursor: Cursor, ch: string): void {
        cursor.show().deleteSelection()
        if (/[a-z]/i.test(ch)) {
            new VanillaSymbol(ch).createLeftOf(cursor)
            return
        }
        // `\` typed into a still-empty name means the user typed `\\`, which is a
        // command in its own right (a line break) — not a command with no name
        if (ch === '\\' && this.isEmpty()) {
            this.input.renderCommand(cursor, '\\')
            return
        }
        // any other character ends the name: render the command, then type the character after it
        this.input.renderCommand(cursor)
        cursor.parent.write(cursor, ch)
    }

    handleKeystroke(key: string, e: KeyboardEvent | undefined, ctrlr: Controller): boolean {
        if (key === 'Tab' || key === 'Enter' || key === 'Spacebar') {
            this.input.renderCommand(ctrlr.cursor)
            e?.preventDefault()
            return true
        }
        return super.handleKeystroke(key, e, ctrlr)
    }
}

export class LatexCommandInput extends MathCommand {
    ctrlSeq = '\\'
    domView = new DOMView(1, (blocks) =>
        h('span', { class: 'mq-latex-command-input-wrapper mq-non-leaf' }, [
            h('span', { class: 'mq-latex-command-input mq-non-leaf' }, [h.text('\\'), h.block('span', {}, blocks[0])]),
        ])
    )
    /** The selection this command was typed over; it becomes the command's content. */
    private wrapped: Fragment | undefined

    protected newBlock(): MathBlock {
        return new CommandNameBlock()
    }

    replaces(fragment: Fragment): void {
        this.wrapped = fragment.disown()
    }

    isEmpty(): boolean {
        return !this.wrapped && super.isEmpty()
    }

    createLeftOf(cursor: Cursor): void {
        super.createLeftOf(cursor)
        if (!this.wrapped) return

        // show the wrapped selection greyed out inside the input; clicks on it
        // go to the input itself (its nodes are no longer part of the tree)
        const frag = this.domFrag()
        this.wrapped.domFrag().addClass('mq-blur').eachElement((el) => (el.style.pointerEvents = 'none'))
        this.wrapped.domFrag().insertBefore(frag.children().first())
    }

    latex(): string {
        return '\\' + this.getEnd(L).latex() + ' '
    }

    /**
     * Replace this input by the command whose name was typed, or by `named`
     * when the name cannot be spelled inside the input (`\\`).
     */
    renderCommand(cursor: Cursor, named?: string): MQNode {
        this.remove()
        const right = this[R]
        if (right) cursor.insLeftOf(right)
        else cursor.insAtRightEnd(this.parent)

        const name = named ?? (this.getEnd(L).latex() || ' ')
        const cmd = latexCommands.create(name)
        if (cmd) {
            if (this.wrapped) cmd.replaces(this.wrapped)
            cmd.createLeftOf(cursor)
            return cmd
        }
        // unknown command: insert its name as text
        const text = new TextBlock()
        text.replaces(name)
        text.createLeftOf(cursor)
        cursor.insRightOf(text)
        if (this.wrapped) this.wrapped.remove()
        return text
    }
}

charCommands.define('\\', LatexCommandInput)
