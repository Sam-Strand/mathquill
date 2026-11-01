/*********************************************
 * Cursor position as plain data, so it survives re-rendering the field from
 * LaTeX (used e.g. to put the cursor back after undo).
 *
 * A point is a path: the child indices from the root down to the block that
 * contains the point, then the offset in that block (the number of nodes to
 * the left, or of characters in a text block).
 ********************************************/
import { L, R } from '../core/direction'
import type { MQNode } from '../tree/node'
import { TextBlock, TextPiece } from '../commands/text'
import type { CursorPosition } from '../public/types'
import type { Controller } from './Controller'

function childIndex(node: MQNode): number {
    let i = 0
    for (let n = node[L]; n; n = n[L]) i += 1
    return i
}

function nthChild(parent: MQNode, i: number): MQNode | undefined {
    let n = parent.getEnd(L)
    for (; n && i > 0; i -= 1) n = n[R]
    return n || undefined
}

/** Path of the point right of `left` (0: at the left end) in `parent`. */
function pathOf(root: MQNode, parent: MQNode, left: MQNode | 0): number[] {
    let offset = 0
    for (let n = left; n; n = n[L]) offset += n instanceof TextPiece ? n.textStr.length : 1
    const path = [offset]
    for (let n = parent; n !== root && n.parent; n = n.parent) path.unshift(childIndex(n))
    return path
}

export class CursorPositions {
    constructor(private readonly ctrlr: Controller) {}

    get(): CursorPosition {
        const { root, cursor } = this.ctrlr
        const position: CursorPosition = { cursor: pathOf(root, cursor.parent, cursor[L]) }
        const seln = cursor.selection
        if (seln) {
            // the anchor is the selection end the cursor is not at
            const cursorAtRight = cursor[L] === seln.getEnd(R)
            const anchorLeft = cursorAtRight ? seln.getEnd(L)[L] : seln.getEnd(R)
            position.anchor = pathOf(root, cursor.parent, anchorLeft)
        }
        return position
    }

    set(position: CursorPosition): void {
        const ctrlr = this.ctrlr
        const cursor = ctrlr.notify('move').cursor
        if (!this.place(position.cursor)) cursor.insAtRightEnd(ctrlr.root)
        else if (position.anchor && this.place(position.anchor)) {
            // the cursor is placed twice: the anchor may have split a text piece the first time
            cursor.startSelection()
            this.place(position.cursor)
            if (!cursor.select()) cursor.show()
        }
        ctrlr.editor.hideCursorIfBlurred()
        ctrlr.scroller.scrollHoriz()
    }

    /** Put the cursor at `path`; false if the path doesn't exist (any more). */
    private place(path: number[]): boolean {
        const cursor = this.ctrlr.cursor
        let parent: MQNode | undefined = this.ctrlr.root
        for (const i of path.slice(0, -1)) {
            parent = parent && nthChild(parent, i)
            if (!parent) return false
        }
        if (!parent) return false

        let offset = path[path.length - 1] ?? 0
        if (!(parent instanceof TextBlock)) {
            const right = nthChild(parent, offset)
            if (right) cursor.insLeftOf(right)
            else cursor.insAtRightEnd(parent)
            return true
        }

        for (let piece = parent.getEnd(L) as TextPiece | 0; piece; piece = piece[R] as TextPiece | 0) {
            if (offset === 0) {
                cursor.insLeftOf(piece)
                return true
            }
            if (offset < piece.textStr.length) {
                cursor.insLeftOf(piece.splitRight(offset))
                return true
            }
            offset -= piece.textStr.length
        }
        cursor.insAtRightEnd(parent)
        return true
    }
}
