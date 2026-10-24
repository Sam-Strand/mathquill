/***************************
 * Superscripts and subscripts.
 *
 * One SupSub node holds a sub block, a sup block or both (`x_1^2`). Typing
 * `^` next to an existing SupSub merges into it (`contactWeld`).
 **************************/
import { L, R, opp, type Direction, type Ends } from '../../core/direction'
import { U_ZERO_WIDTH_SPACE } from '../../core/unicode'
import { domFrag } from '../../core/domFragment'
import { h } from '../../core/dom'
import { linkBlockElement } from '../../tree/domLink'
import { Point } from '../../tree/cursor'
import type { Cursor } from '../../tree/cursor'
import type { MQNode, UpDownTarget } from '../../tree/node'
import type { NodeRef } from '../../tree/fragment'
import { latexCommands } from '../registry'
import { DOMView, MathCommand, MQSymbol, type MathBlock } from './core'
import { Bracket } from './brackets'

type SupOrSub = 'sup' | 'sub'

/**
 * Up/down-out-of handler for a block of `cmd`: leave to the left of the
 * command, unless the cursor is at the very end of every enclosing block.
 */
function leaveUnlessAtEnd(block: MQNode): UpDownTarget {
    return (cursor: Cursor) => {
        const cmd = block.parent
        let ancestor: MQNode | Cursor = cursor
        do {
            if (ancestor[R]) return cursor.insLeftOf(cmd)
            ancestor = ancestor.parent.parent
        } while (ancestor !== cmd)
        cursor.insRightOf(cmd)
        return undefined
    }
}

export class SupSub extends MathCommand {
    declare ends: Ends<MathBlock>
    ctrlSeq = '_{...}^{...}'
    sub: MathBlock | undefined
    sup: MathBlock | undefined
    /** Which block this command was created with. */
    supsub: SupOrSub = 'sup'
    /** Set when this SupSub follows an operator name (adds spacing). */
    private afterOperatorName = false
    /** After merging into a neighbour: where `placeCursor` should go. */
    private mergedInto: { block: MathBlock; dir: Direction } | undefined

    isSupSub(): boolean {
        return true
    }

    getEnd(dir: Direction): MathBlock {
        return this.ends[dir]
    }

    createLeftOf(cursor: Cursor): void {
        if (!this.replacedFragment && !cursor[L] && cursor.options.supSubsRequireOperand) return
        super.createLeftOf(cursor)
    }

    placeCursor(cursor: Cursor): void {
        if (this.mergedInto) cursor.insAtDirEnd(opp(this.mergedInto.dir), this.mergedInto.block)
        else super.placeCursor(cursor)
    }

    /**
     * If a SupSub is adjacent, move my blocks into it: a block it lacks is
     * added, a block it has gets my block's children. Then remove myself.
     */
    contactWeld(cursor: Cursor): void {
        for (const dir of [L, R] as const) {
            const neighbour = this[dir]
            if (!(neighbour instanceof SupSub)) continue

            let pt: Point | undefined
            for (const which of ['sub', 'sup'] as const) {
                const src = this[which]
                const dest = neighbour[which]
                if (!src) continue
                if (!dest) {
                    neighbour.addBlock(src.disown())
                } else if (!src.isEmpty()) {
                    // insert src's children at the -dir end of dest
                    src.domFrag().children().insAtDirEnd(opp(dir), dest.domFrag().oneElement())
                    const children = src.children().disown()
                    pt = new Point(dest, children.getEnd(R), dest.getEnd(L))
                    if (dir === L) children.adopt(dest, dest.getEnd(R), 0)
                    else children.adopt(dest, 0, dest.getEnd(L))
                } else {
                    pt = new Point(dest, 0, dest.getEnd(L))
                }
                this.mergedInto = { block: dest || src, dir }
            }
            this.remove()
            if (cursor && cursor[L] === this) {
                if (dir === R && pt) {
                    const ptL = pt[L]
                    if (ptL) cursor.insRightOf(ptL)
                    else cursor.insAtLeftEnd(pt.parent)
                } else cursor.insRightOf(neighbour)
            }
            break
        }
    }

    writeInBlock(block: MathBlock, cursor: Cursor, ch: string): void {
        const opts = cursor.options
        if (opts.autoSubscriptNumerals && block === this.sub) {
            if (ch === '_') return
            const cmd = block.chToCmd(ch, opts)
            if (cmd instanceof MQSymbol) cursor.deleteSelection()
            else cursor.clearSelection().insRightOf(this)
            cmd.createLeftOf(cursor.show())
            return
        }
        if (cursor[L] && !cursor[R] && !cursor.selection && opts.charsThatBreakOutOfSupSub.indexOf(ch) > -1) {
            cursor.insRightOf(this)
        }
        block.writeDefault(cursor, ch)
    }

    /** Deleting out of one block of a sub+sup pair removes that block, keeping its contents. */
    deleteOutOfBlock(block: MathBlock, dir: Direction, cursor: Cursor): void {
        const sub = this.sub
        const sup = this.sup
        if (!sub || !sup) {
            super.deleteOutOfBlock(block, dir, cursor)
            return
        }
        const which: SupOrSub = block === sub ? 'sub' : 'sup'
        const remaining = which === 'sub' ? sup : sub

        cursor.insDirOf(block[dir] ? opp(dir) : dir, this)
        if (!block.isEmpty()) {
            const end = block.getEnd(dir)
            block
                .children()
                .disown()
                .withDirAdopt(dir, cursor.parent, cursor[dir], cursor[opp(dir)])
                .domFrag()
                .insDirOf(opp(dir), cursor.domFrag())
            cursor[opp(dir)] = end
        }
        this.supsub = which === 'sub' ? 'sup' : 'sub'
        if (which === 'sub') {
            this.sub = undefined
            this.downInto = undefined
            remaining.downOutOf = leaveUnlessAtEnd(remaining)
            this.domFrag().addClass('mq-sup-only').children().last().remove()
        } else {
            this.sup = undefined
            this.upInto = undefined
            remaining.upOutOf = leaveUnlessAtEnd(remaining)
        }
        block.remove()
    }

    moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down'): void {
        if (cursor.options.autoSubscriptNumerals && !this.sup) cursor.insDirOf(dir, this)
        else super.moveTowards(dir, cursor, updown)
    }

    deleteTowards(dir: Direction, cursor: Cursor): void {
        if (cursor.options.autoSubscriptNumerals && this.sub) {
            const cmd = this.sub.getEnd(opp(dir))
            if (cmd instanceof MQSymbol) cmd.remove()
            else if (cmd) cmd.deleteTowards(dir, cursor.insAtDirEnd(opp(dir), this.sub))

            if (this.sub.isEmpty()) {
                this.sub.deleteOutOf(L, cursor.insAtLeftEnd(this.sub))
                // `-dir`: in `x_1^2|`, Backspace deletes the 1 but ends up right of x^2
                if (this.sup) cursor.insDirOf(opp(dir), this)
            }
        } else super.deleteTowards(dir, cursor)
    }

    latex(): string {
        const part = (prefix: string, block: NodeRef | undefined) =>
            block ? prefix + '{' + (block.latex() || ' ') + '}' : ''
        return part('_', this.sub) + part('^', this.sup)
    }

    text(): string {
        const part = (prefix: string, block: NodeRef | undefined) => {
            if (!block) return ''
            const t = block.text() || ''
            return prefix + (t.length === 1 ? t : '(' + (t || ' ') + ')')
        }
        return part('_', this.sub) + part('^', this.sup)
    }

    /** Add the missing sub or sup block. */
    addBlock(block: MathBlock): void {
        if (this.supsub === 'sub') {
            const sub = this.sub as MathBlock
            this.sup = this.upInto = block
            sub.upOutOf = block
            block.adopt(this, sub, 0).downOutOf = sub
            block.setDOM(
                domFrag(h('span', { class: 'mq-sup' }))
                    .append(block.domFrag().children())
                    .prependTo(this.domFrag().oneElement())
                    .oneElement()
            )
        } else {
            const sup = this.sup as MathBlock
            this.sub = this.downInto = block
            sup.downOutOf = block
            block.adopt(this, 0, sup).upOutOf = sup
            this.domFrag().removeClass('mq-sup-only')
            block.setDOM(
                domFrag(h('span', { class: 'mq-sub' }))
                    .append(block.domFrag().children())
                    .appendTo(this.domFrag().oneElement())
                    .oneElement()
            )
            this.domFrag().append(
                domFrag(h('span', { style: 'display:inline-block;width:0' }, [h.text(U_ZERO_WIDTH_SPACE)]))
            )
        }
        linkBlockElement(block.domFrag().oneElement(), block)
    }

    markAfterOperatorName(): void {
        this.afterOperatorName = true
        this.respace()
    }

    private respace(): void {
        this.domFrag().toggleClass('mq-after-operator-name', !(this[R] instanceof Bracket))
    }

    siblingCreated(): void {
        if (this.afterOperatorName) this.respace()
    }

    siblingDeleted(): void {
        if (this.afterOperatorName) this.respace()
    }
}

export class SubscriptCommand extends SupSub {
    supsub: SupOrSub = 'sub'
    domView = new DOMView(1, (blocks) =>
        h('span', { class: 'mq-supsub mq-non-leaf' }, [
            h.block('span', { class: 'mq-sub' }, blocks[0]),
            h('span', { style: 'display:inline-block;width:0' }, [h.text(U_ZERO_WIDTH_SPACE)]),
        ])
    )

    finalizeTree(): void {
        const sub = (this.downInto = this.sub = this.getEnd(L))
        sub.upOutOf = leaveUnlessAtEnd(sub)
    }
}

export class SuperscriptCommand extends SupSub {
    supsub: SupOrSub = 'sup'
    domView = new DOMView(1, (blocks) =>
        h('span', { class: 'mq-supsub mq-non-leaf mq-sup-only' }, [h.block('span', { class: 'mq-sup' }, blocks[0])])
    )

    finalizeTree(): void {
        const sup = (this.upInto = this.sup = this.getEnd(R))
        sup.downOutOf = leaveUnlessAtEnd(sup)
    }
}

latexCommands.define(['subscript', '_'], SubscriptCommand)
latexCommands.define(['superscript', 'supscript', '^'], SuperscriptCommand)
