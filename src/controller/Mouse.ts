/********************************************************
 * Mouse: click to place the cursor, drag to select.
 *******************************************************/
import { domFrag } from '../core/domFragment'
import { closest } from '../core/dom'
import { nodeOfElement } from '../tree/domLink'
import type { MQNode } from '../tree/node'
import { resetIgnoreNextMousedown } from '../options'
import type { MathBlock } from '../commands/math/core'
import type { Controller, ControllerEvent } from './Controller'

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
        let node: MQNode | undefined
        for (let el = target; el && !node; el = el.parentElement) node = nodeOfElement(el)

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

        cursor.blink = () => {}
        this.seek(e.target as Element | null, e.clientX, e.clientY).cursor.startSelection()

        // listen on the document to hear about mousemove/mouseup outside the field (and the page)
        rootElement?.addEventListener('mousemove', onRootMouseMove as EventListener)
        ownerDocument?.addEventListener('mousemove', onDocumentMouseMove)
        ownerDocument?.addEventListener('mouseup', onDocumentMouseUp)
    }
}
