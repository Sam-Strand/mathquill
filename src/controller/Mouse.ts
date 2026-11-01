/********************************************************
 * Mouse: click to place the cursor, drag to select, drag a selection to
 * move it (with Ctrl/Alt/Cmd: copy it).
 *******************************************************/
import { L, R } from '../core/direction'
import { domFrag } from '../core/domFragment'
import { closest } from '../core/dom'
import { nodeOfElement } from '../tree/domLink'
import { Fragment } from '../tree/fragment'
import { Point } from '../tree/cursor'
import type { MQSelection } from '../tree/selection'
import type { MQNode } from '../tree/node'
import { resetIgnoreNextMousedown } from '../options'
import type { MathBlock } from '../commands/math/core'
import { TextBlock } from '../commands/text'
import type { Controller, ControllerEvent } from './Controller'

/** How far (px) the mouse must move with the button down on a selection to start dragging it. */
const DRAG_THRESHOLD = 3

/** The innermost node rendered by `target` or one of its ancestors. */
function nodeAt(target: Element | null): MQNode | undefined {
    let node: MQNode | undefined
    for (let el = target; el && !node; el = el.parentElement) node = nodeOfElement(el)
    return node
}

function contains(seln: MQSelection, node: MQNode): boolean {
    let found = false
    seln.each((n) => {
        if (n === node) found = true
        return !found
    })
    return found
}

export class Mouse {
    /** Set while a mouse button is down in this field; cancels the drag on edits. */
    private cancelDrag: (() => void) | undefined

    constructor(private readonly ctrlr: Controller) {}

    attach(): void {
        this.ctrlr.container.addEventListener('mousedown', this.onMouseDown)
    }

    detach(): void {
        this.ctrlr.container.removeEventListener('mousedown', this.onMouseDown)
    }

    /** Edits invalidate an in-progress mouse selection. */
    onNotify(e: ControllerEvent): void {
        if ((e === 'edit' || e === 'replace') && this.cancelDrag) this.cancelDrag()
    }

    /** Put the cursor at the position (clientX) within the node rendered by `target`. */
    seek(target: Element | null, clientX: number, _clientY: number): Controller {
        const ctrlr = this.ctrlr
        const cursor = ctrlr.notify('select').cursor

        // the target may be nested deeper than the elements MathQuill knows about
        const node = nodeAt(target)

        // clear the selection only now: the target may have been the selection span
        cursor.clearSelection().show()
        ;(node ?? ctrlr.root).seek(clientX, cursor)
        // scroll before selecting, so the no-selection case (which scrolls slower) applies
        ctrlr.scroller.scrollHoriz()
        return ctrlr
    }

    private readonly onMouseDown = (e: MouseEvent): void => {
        // the event may come from an inner field of static math: use that field's controller
        const rootElement = closest(e.target, '.mq-root-block')
        const root = (nodeOfElement(rootElement) ?? this.ctrlr.root) as MathBlock
        const ctrlr = root.controller ?? this.ctrlr
        ctrlr.mouse.startDrag(e, rootElement)
    }

    private startDrag(e: MouseEvent, rootElement: Element | null): void {
        const ctrlr = this.ctrlr
        const cursor = ctrlr.cursor
        const blink = cursor.blink
        const textareaSpan = ctrlr.textarea.getSpanOrThrow()
        const textarea = ctrlr.textarea.getElementOrThrow()
        const ownerDocument = ctrlr.root.domFrag().firstNode().ownerDocument

        e.preventDefault()

        if (cursor.options.ignoreNextMousedown(e)) return
        resetIgnoreNextMousedown(cursor.options)

        // outside rootElement, the node of the mousemove target (if any) belongs
        // to another tree: don't mislead seek() with it
        let lastMousemoveTarget: Element | null = null
        const onRootMouseMove = (e: MouseEvent) => {
            lastMousemoveTarget = e.target as Element | null
        }
        const onDocumentMouseMove = (e: MouseEvent) => {
            if (!cursor.anticursor) cursor.startSelection()
            ctrlr.mouse.seek(lastMousemoveTarget, e.clientX, e.clientY).cursor.select()
            lastMousemoveTarget = null
        }
        const unbind = () => {
            rootElement?.removeEventListener('mousemove', onRootMouseMove as EventListener)
            ownerDocument?.removeEventListener('mousemove', onDocumentMouseMove)
            ownerDocument?.removeEventListener('mouseup', onDocumentMouseUp)
            this.cancelDrag = undefined
        }
        const updateCursor = () => {
            if (ctrlr.editable) cursor.show()
            else domFrag(textareaSpan).detach()
        }
        const onDocumentMouseUp = () => {
            cursor.blink = blink
            if (!cursor.selection) updateCursor()
            unbind()
        }

        let wasEdited = false
        this.cancelDrag = () => {
            // an edit while the button is down invalidates the selection
            wasEdited = true
            cursor.blink = blink
            cursor.clearSelection()
            updateCursor()
            unbind()
        }

        if (ctrlr.blurred) {
            if (rootElement && !ctrlr.editable) domFrag(rootElement).prepend(domFrag(textareaSpan))
            textarea.focus()
            // focus handlers may write to the field, which cancels the drag
            if (wasEdited) return
        }

        const seln = cursor.selection
        if (ctrlr.editable && seln && !seln.isCleared() && e.target instanceof Node) {
            // text blocks re-fuse their pieces when seeking, which would break the selection
            const draggable = !(seln.getEnd(L).parent instanceof TextBlock)
            if (draggable && seln.domFrag().oneElement().contains(e.target)) {
                this.startSelectionDrag(e, rootElement, ownerDocument)
                return
            }
        }

        cursor.blink = () => {}
        this.seek(e.target as Element | null, e.clientX, e.clientY).cursor.startSelection()

        // listen on the document to hear about mousemove/mouseup outside the field (and the page)
        rootElement?.addEventListener('mousemove', onRootMouseMove as EventListener)
        ownerDocument?.addEventListener('mousemove', onDocumentMouseMove)
        ownerDocument?.addEventListener('mouseup', onDocumentMouseUp)
    }

    /**
     * Mouse down on the selection: a click puts the cursor there (like
     * anywhere else), dragging moves the selection, or copies it if
     * Ctrl/Alt/Cmd is held on release.
     */
    private startSelectionDrag(e: MouseEvent, rootElement: Element | null, ownerDocument: Document | null): void {
        const ctrlr = this.ctrlr
        const cursor = ctrlr.cursor
        const downTarget = e.target as Element
        const startX = e.clientX
        const startY = e.clientY
        // where the cursor goes back to if the drop does nothing
        const home = Point.copy(cursor)
        let dragging = false

        const onMouseMove = (e: MouseEvent) => {
            if (!dragging) {
                if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return
                dragging = true
                domFrag(ctrlr.container).addClass('mq-dragging')
            }
            // the cursor shows the drop position; the selection stays
            const target = e.target instanceof Element && rootElement?.contains(e.target) ? e.target : null
            cursor.hide()
            ;(nodeAt(target) ?? ctrlr.root).seek(e.clientX, cursor)
            cursor.show()
            ctrlr.scroller.scrollHoriz()
        }
        const unbind = () => {
            ownerDocument?.removeEventListener('mousemove', onMouseMove)
            ownerDocument?.removeEventListener('mouseup', onMouseUp)
            domFrag(ctrlr.container).removeClass('mq-dragging')
            this.cancelDrag = undefined
        }
        const onMouseUp = (e: MouseEvent) => {
            unbind()
            if (!dragging) this.seek(downTarget, startX, startY)
            else if (!this.dropSelection(e.ctrlKey || e.altKey || e.metaKey)) {
                // dropped onto itself: keep the selection, put the cursor back
                cursor.hide()
                const homeR = home[R]
                if (homeR) cursor.insLeftOf(homeR)
                else cursor.insAtRightEnd(home.parent)
            }
        }
        this.cancelDrag = unbind

        ownerDocument?.addEventListener('mousemove', onMouseMove)
        ownerDocument?.addEventListener('mouseup', onMouseUp)
    }

    /** Whether the cursor is inside the selection or right next to it. */
    private cursorTouches(seln: MQSelection): boolean {
        const cursor = this.ctrlr.cursor
        const parent = seln.getEnd(L).parent
        if (cursor.parent === parent) {
            const left = cursor[L]
            return cursor[R] === seln.getEnd(L) || (!!left && contains(seln, left))
        }
        for (let node: MQNode = cursor.parent; node; node = node.parent) {
            if (node.parent === parent) return contains(seln, node)
        }
        return false
    }

    /**
     * Insert the selection at the cursor (removing the original unless
     * `copy`) and select the inserted copy. As one edit, so the `edit`
     * handler is called once. Returns false if the cursor touches the
     * selection, which then stays as it is.
     */
    private dropSelection(copy: boolean): boolean {
        const ctrlr = this.ctrlr
        const cursor = ctrlr.cursor
        const seln = cursor.selection
        if (!seln || this.cursorTouches(seln)) return false

        const latex = seln.latex()
        const from = seln.getEnd(L).parent
        const selFirst = seln.getEnd(L)
        const selLast = seln.getEnd(R)
        const original = new Fragment(selFirst, selLast)
        cursor.clearSelection()
        const before = cursor[L]

        ctrlr.withHandlersMuted(() => {
            ctrlr.latex.writeLatex(latex)
            if (copy) return
            const left = selFirst[L]
            const right = selLast[R]
            original.remove()
            if (left) left.siblingDeleted(cursor.options, R)
            if (right) right.siblingDeleted(cursor.options, L)
            // a block the cursor isn't in shows its empty state on blur
            if (from !== cursor.parent) from.blur(cursor)
            from.bubble((node) => node.reflow())
        })

        const last = cursor[L]
        if (last && last !== before && !(cursor.parent instanceof TextBlock)) {
            const first = before ? (before[R] as MQNode) : (cursor.parent.getEnd(L) as MQNode)
            cursor.insLeftOf(first)
            cursor.startSelection()
            cursor.insRightOf(last)
            if (!cursor.select()) cursor.show()
        }
        cursor.parent.bubble((node) => node.reflow())
        ctrlr.scroller.scrollHoriz()
        return true
    }
}
