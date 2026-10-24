/*********************************************
 * Focus and blur of a field (through its textarea).
 ********************************************/
import { domFrag } from '../core/domFragment'
import type { Controller, ControllerEvent } from './Controller'

export class FocusBlur {
    private blurTimeout = 0
    private groupingTimeout = 0

    constructor(private readonly ctrlr: Controller) {}

    /** Edits while focused suspend digit grouping for a second, so digits don't jump around while typing. */
    onNotify(e: ControllerEvent): void {
        if (e !== 'edit' && e !== 'replace' && e !== undefined) return
        if (!this.ctrlr.options.enableDigitGrouping) return
        if (this.ctrlr.blurred !== false) return
        this.disableGroupingForSeconds(1)
    }

    disableGroupingForSeconds(seconds: number): void {
        const root = this.ctrlr.root
        clearTimeout(this.groupingTimeout)
        if (seconds === 0) {
            root.domFrag().removeClass('mq-suppress-grouping')
        } else {
            root.domFrag().addClass('mq-suppress-grouping')
            this.groupingTimeout = window.setTimeout(() => {
                root.domFrag().removeClass('mq-suppress-grouping')
            }, seconds * 1000)
        }
    }

    addEditableListeners(): void {
        const ctrlr = this.ctrlr
        ctrlr.textarea.addListeners({ focus: this.onFocusEditable, blur: this.onBlurEditable })
        ctrlr.blurred = true
        ctrlr.cursor.hide().parent.blur(ctrlr.cursor)
    }

    addStaticListeners(): void {
        this.ctrlr.textarea.addListeners({ focus: this.onFocusStatic, blur: this.onBlurStatic })
    }

    /** Stop all pending timers and window listeners. */
    detach(): void {
        clearTimeout(this.blurTimeout)
        clearTimeout(this.groupingTimeout)
        window.removeEventListener('blur', this.onWindowBlur)
    }

    /** Leave the field: hide the cursor and blur the block it was in. */
    blur(): void {
        const ctrlr = this.ctrlr
        const cursor = ctrlr.cursor
        cursor.hide().parent.blur(cursor)
        domFrag(ctrlr.container).removeClass('mq-focused')
        window.removeEventListener('blur', this.onWindowBlur)
        if (ctrlr.options.resetCursorOnBlur) cursor.resetToEnd(ctrlr.root)
    }

    private readonly onFocusEditable = (): void => {
        const ctrlr = this.ctrlr
        const cursor = ctrlr.cursor
        ctrlr.blurred = false
        clearTimeout(this.blurTimeout)
        domFrag(ctrlr.container).addClass('mq-focused')
        if (!cursor.parent) cursor.insAtRightEnd(ctrlr.root)
        if (cursor.selection) {
            cursor.selection.domFrag().removeClass('mq-blur')
            ctrlr.onSelectionChanged() // re-select the textarea contents after tabbing away and back
        } else {
            cursor.show()
        }
        ctrlr.scroller.setOverflowClasses()
    }

    private readonly onBlurEditable = (): void => {
        const ctrlr = this.ctrlr
        ctrlr.textarea.cancelPendingSelection()
        this.disableGroupingForSeconds(0)
        ctrlr.blurred = true
        // If the window blurs too before this runs, it was not an intentional
        // blur (just switching tabs/windows): see onWindowBlur. (#264)
        this.blurTimeout = window.setTimeout(() => {
            ctrlr.root.postOrder((node) => node.intentionalBlur())
            ctrlr.cursor.clearSelection().endSelection()
            this.blur()
            ctrlr.scroller.scrollHoriz()
        })
        window.addEventListener('blur', this.onWindowBlur)
    }

    private readonly onWindowBlur = (): void => {
        clearTimeout(this.blurTimeout)
        const selection = this.ctrlr.cursor.selection
        if (selection) selection.domFrag().addClass('mq-blur')
        this.blur()
    }

    private readonly onFocusStatic = (): void => {
        this.ctrlr.blurred = false
    }

    private readonly onBlurStatic = (): void => {
        const ctrlr = this.ctrlr
        ctrlr.cursor.selection?.clear()
        // detaching during blur explodes in WebKit
        window.setTimeout(() => {
            domFrag(ctrlr.textarea.getSpanOrThrow()).detach()
            ctrlr.blurred = true
        })
    }
}
