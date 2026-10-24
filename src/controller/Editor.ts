/*****************************************
 * Editing operations: the key map, cursor movement, deletion, selection,
 * typing and clipboard. Everything here acts through the cursor.
 ****************************************/
import { L, R, opp, type Direction } from '../core/direction'
import { Fragment } from '../tree/fragment'
import { MQNode } from '../tree/node'
import { latexCommands } from '../commands/registry'
import type { Controller } from './Controller'

export class Editor {
    constructor(private readonly ctrlr: Controller) {}

    private get cursor() {
        return this.ctrlr.cursor
    }

    // ---- keystrokes ----------------------------------------------------------

    /**
     * Handle a key combo like `'Shift-Left'`. The block containing the cursor
     * may handle it first (see `MQNode.handleKeystroke`).
     */
    keystroke(key: string, e?: KeyboardEvent): void {
        const ctrlr = this.ctrlr
        if (this.cursor.parent.handleKeystroke(key, e, ctrlr)) return
        if (!this.runKeyCommand(key, e)) return
        e?.preventDefault()
        ctrlr.scroller.scrollHoriz()
    }

    /** Returns false for keys that are not handled (or that handle the event themselves). */
    private runKeyCommand(key: string, e: KeyboardEvent | undefined): boolean {
        const ctrlr = this.ctrlr
        const cursor = this.cursor
        switch (key) {
            case 'Ctrl-Shift-Backspace':
            case 'Ctrl-Backspace':
                this.ctrlDeleteDir(L)
                return true
            case 'Shift-Backspace':
            case 'Backspace':
                this.backspace()
                return true

            // Tab / Esc: go one block right if it exists, else escape right
            case 'Esc':
            case 'Tab':
                this.escapeDir(R, e)
                return false
            case 'Shift-Tab':
            case 'Shift-Esc':
                this.escapeDir(L, e)
                return false

            case 'End':
                ctrlr.notify('move').cursor.insAtRightEnd(cursor.parent)
                return true
            case 'Ctrl-End':
                ctrlr.notify('move').cursor.insAtRightEnd(ctrlr.root)
                return true
            case 'Shift-End':
                this.selectToBlockEndInDir(R)
                return true
            case 'Ctrl-Shift-End':
                this.selectToRootEndInDir(R)
                return true
            case 'Home':
                ctrlr.notify('move').cursor.insAtLeftEnd(cursor.parent)
                return true
            case 'Ctrl-Home':
                ctrlr.notify('move').cursor.insAtLeftEnd(ctrlr.root)
                return true
            case 'Shift-Home':
                this.selectToBlockEndInDir(L)
                return true
            case 'Ctrl-Shift-Home':
                this.selectToRootEndInDir(L)
                return true

            case 'Left':
                this.moveLeft()
                return true
            case 'Shift-Left':
                this.selectLeft()
                return true
            case 'Right':
                this.moveRight()
                return true
            case 'Shift-Right':
                this.selectRight()
                return true
            case 'Up':
                this.moveUp()
                return true
            case 'Down':
                this.moveDown()
                return true

            case 'Shift-Up':
                // select to the start of the block, or one more step out
                this.withIncrementalSelection((selectDir) => {
                    if (cursor[L]) while (cursor[L]) selectDir(L)
                    else selectDir(L)
                })
                return true
            case 'Shift-Down':
                this.withIncrementalSelection((selectDir) => {
                    if (cursor[R]) while (cursor[R]) selectDir(R)
                    else selectDir(R)
                })
                return true

            case 'Ctrl-Shift-Del':
            case 'Ctrl-Del':
                this.ctrlDeleteDir(R)
                return true
            case 'Shift-Del':
            case 'Del':
                this.deleteForward()
                return true

            case 'Meta-A':
            case 'Ctrl-A':
                this.selectAll()
                return true

            // reserved, so the browser default does not kick in
            case 'Ctrl-Left':
            case 'Ctrl-Right':
            case 'Ctrl-Up':
            case 'Ctrl-Down':
            case 'Ctrl-Alt-Up':
            case 'Ctrl-Alt-Down':
            case 'Ctrl-Alt-Left':
            case 'Ctrl-Alt-Right':
            case 'Ctrl-Alt-Shift-Down':
            case 'Ctrl-Alt-=':
            case 'Ctrl-Alt-Shift-Right':
                return true

            default:
                return false
        }
    }

    // ---- typing --------------------------------------------------------------

    /** A single character typed by the user (`'\n'` triggers the `enter` handler). */
    typedText(ch: string): void {
        if (ch === '\n') {
            this.ctrlr.handle('enter')
            return
        }
        const cursor = this.ctrlr.notify(undefined).cursor
        cursor.parent.write(cursor, ch)
        this.ctrlr.scroller.scrollHoriz()
    }

    /** Insert a command (`\sqrt`) or write a character, at the cursor. */
    cmd(cmd: string): void {
        const cursor = this.ctrlr.notify(undefined).cursor
        if (/^\\[a-z]+$/i.test(cmd) && !cursor.isTooDeep()) {
            const node = latexCommands.create(cmd.slice(1))
            if (node) {
                const selection = cursor.selection && cursor.replaceSelection()
                if (selection) node.replaces(selection)
                node.createLeftOf(cursor.show())
            }
        } else {
            cursor.parent.write(cursor, cmd)
        }
        this.ctrlr.scroller.scrollHoriz()
        this.hideCursorIfBlurred()
    }

    /** Insert LaTeX at the cursor. */
    write(latex: string): void {
        this.ctrlr.latex.writeLatex(latex)
        this.ctrlr.scroller.scrollHoriz()
        this.hideCursorIfBlurred()
    }

    hideCursorIfBlurred(): void {
        const cursor = this.cursor
        if (this.ctrlr.blurred) cursor.hide().parent.blur(cursor)
    }

    // ---- clipboard -----------------------------------------------------------

    cut(): void {
        const ctrlr = this.ctrlr
        const cursor = this.cursor
        if (!cursor.selection) return
        setTimeout(() => {
            ctrlr.notify('edit') // deletes the selection
            cursor.parent.bubble((node) => node.reflow())
            ctrlr.options.onCut?.()
        })
    }

    copy(): void {
        this.ctrlr.textarea.setTextareaSelection()
    }

    paste(text: string): void {
        const ctrlr = this.ctrlr
        // statelessClipboard: only $-delimited text is math, the rest is \text{}
        // (only works in math fields so far)
        if (ctrlr.options.statelessClipboard) {
            if (text.slice(0, 1) === '$' && text.slice(-1) === '$') text = text.slice(1, -1)
            else text = '\\text{' + text + '}'
        }
        // FIXME: this always inserts math or a TextBlock, even in a RootTextBlock
        ctrlr.latex.writeLatex(text)
        this.cursor.show()
        ctrlr.scroller.scrollHoriz()
        ctrlr.options.onPaste?.()
    }

    // ---- movement --------------------------------------------------------------

    /** Leave the current block in direction `dir` (Tab / Shift-Tab). A no-op in the root. */
    escapeDir(dir: Direction, e?: KeyboardEvent): void {
        const cursor = this.cursor
        // in the root, Tab keeps its default browser action (focus the next field)
        if (cursor.parent === this.ctrlr.root) return
        e?.preventDefault()
        cursor.clearSelection()
        cursor.parent.moveOutOf(dir, cursor)
        this.ctrlr.notify('move')
    }

    moveDir(dir: Direction): void {
        const cursor = this.cursor
        const updown = cursor.options.leftRightIntoCmdGoes
        const next = cursor[dir]
        if (cursor.selection) cursor.insDirOf(dir, cursor.selection.getEnd(dir))
        else if (next) next.moveTowards(dir, cursor, updown)
        else cursor.parent.moveOutOf(dir, cursor, updown)
        this.ctrlr.notify('move')
    }

    moveLeft(): void {
        this.moveDir(L)
    }

    moveRight(): void {
        this.moveDir(R)
    }

    moveUp(): void {
        this.moveUpDown('up')
    }

    moveDown(): void {
        this.moveUpDown('down')
    }

    /**
     * Up/Down: enter the block above/below an adjacent command, else ask the
     * ancestors (innermost first) where `upOutOf`/`downOutOf` leads:
     * a node is jumped into; a function is called with the cursor.
     */
    private moveUpDown(dir: 'up' | 'down'): void {
        const cursor = this.ctrlr.notify('upDown').cursor
        const into = dir === 'up' ? 'upInto' : 'downInto'
        const outOf = dir === 'up' ? 'upOutOf' : 'downOutOf'

        const rightInto = cursor[R] && cursor[R][into]
        const leftInto = cursor[L] && cursor[L][into]
        if (rightInto) cursor.insAtLeftEnd(rightInto)
        else if (leftInto) cursor.insAtRightEnd(leftInto)
        else {
            cursor.parent.bubble((ancestor) => {
                const target = ancestor[outOf]
                if (!target) return
                const result = typeof target === 'function' ? target(cursor) : target
                if (result instanceof MQNode) cursor.jumpUpDown(ancestor, result)
                return false
            })
        }
    }

    // ---- deletion --------------------------------------------------------------

    deleteDir(dir: Direction): void {
        const cursor = this.cursor
        const hadSelection = cursor.selection
        this.ctrlr.notify('edit') // deletes the selection if present
        if (!hadSelection) {
            const next = cursor[dir]
            if (next) next.deleteTowards(dir, cursor)
            else cursor.parent.deleteOutOf(dir, cursor)
        }
        this.afterDelete()
    }

    /** Ctrl-Backspace / Ctrl-Del: delete to the end of the block. */
    ctrlDeleteDir(dir: Direction): void {
        const cursor = this.cursor
        if (!cursor[dir] || cursor.selection) {
            this.deleteDir(dir)
            return
        }
        this.ctrlr.notify('edit')
        const removed =
            dir === L ? new Fragment(cursor.parent.getEnd(L), cursor[L]) : new Fragment(cursor[R], cursor.parent.getEnd(R))
        removed.remove()
        cursor.insAtDirEnd(dir, cursor.parent)
        this.afterDelete()
    }

    private afterDelete(): void {
        const cursor = this.cursor
        const left = cursor[L]
        const right = cursor[R]
        if (left) left.siblingDeleted(cursor.options, R)
        if (right) right.siblingDeleted(cursor.options, L)
        cursor.parent.bubble((node) => node.reflow())
    }

    backspace(): void {
        this.deleteDir(L)
    }

    deleteForward(): void {
        this.deleteDir(R)
    }

    // ---- selection -------------------------------------------------------------

    /**
     * Build a selection incrementally: `cb` may call `selectDir` many times,
     * the DOM is updated once at the end.
     */
    withIncrementalSelection(cb: (selectDir: (dir: Direction) => void) => void): void {
        this.startIncrementalSelection()
        try {
            cb((dir) => this.selectDirIncremental(dir))
        } finally {
            // finish even if the callback threw
            this.finishIncrementalSelection()
        }
    }

    private startIncrementalSelection(): void {
        this.ctrlr.notify('select')
        if (!this.cursor.anticursor) this.cursor.startSelection()
    }

    /** Extend the selection model (stored in the cursor) by one step, without touching the DOM. */
    private selectDirIncremental(dir: Direction): void {
        const cursor = this.cursor
        const seln = cursor.selection
        const node = cursor[dir]
        if (node) {
            // the node we select towards is the only selected node, on the far
            // side, and the anticursor is inside it: retract into it
            if (seln && seln.getEnd(dir) === node && cursor.anticursor?.[opp(dir)] !== node) {
                node.unselectInto(dir, cursor)
            } else node.selectTowards(dir, cursor)
        } else cursor.parent.selectOutOf(dir, cursor)
    }

    /** Update the selection DOM to match the cursor model. */
    private finishIncrementalSelection(): void {
        const cursor = this.cursor
        cursor.clearSelection()
        if (!cursor.select()) cursor.show()
    }

    /** Grow the selection one step (not for use in a loop, see withIncrementalSelection). */
    selectDir(dir: Direction): void {
        this.withIncrementalSelection((selectDir) => selectDir(dir))
    }

    selectLeft(): void {
        this.selectDir(L)
    }

    selectRight(): void {
        this.selectDir(R)
    }

    selectAll(): void {
        this.ctrlr.notify('move')
        const cursor = this.cursor
        cursor.insAtRightEnd(this.ctrlr.root)
        this.withIncrementalSelection((selectDir) => {
            while (cursor[L]) selectDir(L)
        })
    }

    selectToBlockEndInDir(dir: Direction): void {
        const cursor = this.cursor
        this.withIncrementalSelection((selectDir) => {
            while (cursor[dir]) selectDir(dir)
        })
    }

    selectToRootEndInDir(dir: Direction): void {
        const cursor = this.cursor
        this.withIncrementalSelection((selectDir) => {
            while (cursor[dir] || cursor.parent !== this.ctrlr.root) selectDir(dir)
        })
    }
}
