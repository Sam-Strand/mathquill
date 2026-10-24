/***********************************************
 * Horizontal scrolling of editable fields wider than their box.
 **********************************************/
import { L, R } from '../core/direction'
import { getBoundingClientRect } from '../core/geometry'
import { animate } from '../core/animate'
import type { Controller } from './Controller'

/** Keep the cursor at least this many pixels away from the edges. */
const MARGIN = 20

export class Scroller {
    private cancelAnimation: (() => void) | undefined

    constructor(private readonly ctrlr: Controller) {}

    /** Classes showing that there is hidden content on either side (while focused). */
    setOverflowClasses(): void {
        const root = this.ctrlr.root.domFrag().oneElement()
        let overflowRight = false
        let overflowLeft = false
        if (!this.ctrlr.blurred) {
            const width = getBoundingClientRect(root).width
            overflowRight = root.scrollWidth > width + root.scrollLeft
            overflowLeft = root.scrollLeft > 0
        }
        root.classList.toggle('mq-editing-overflow-right', overflowRight)
        root.classList.toggle('mq-editing-overflow-left', overflowLeft)
    }

    /** Scroll so that the cursor (or the selection) is visible. */
    scrollHoriz(): void {
        const cursor = this.ctrlr.cursor
        const seln = cursor.selection
        const rootEl = this.ctrlr.root.domFrag().oneElement()
        const rootRect = getBoundingClientRect(rootEl)

        if (cursor.domFrag().isEmpty() && !seln) {
            // cursor hidden (field blurred): scroll back to the start
            this.animateTo(rootEl, -rootEl.scrollLeft)
            return
        }

        let scrollBy: number
        if (!seln) {
            const x = getBoundingClientRect(cursor.domFrag().oneElement()).left
            if (x > rootRect.right - MARGIN) scrollBy = x - (rootRect.right - MARGIN)
            else if (x < rootRect.left + MARGIN) scrollBy = x - (rootRect.left + MARGIN)
            else return
        } else {
            const rect = getBoundingClientRect(seln.domFrag().oneElement())
            const overLeft = rect.left - (rootRect.left + MARGIN)
            const overRight = rect.right - (rootRect.right - MARGIN)
            if (seln.getEnd(L) === cursor[R]) {
                // cursor at the left end of the selection: prefer showing the left
                if (overLeft < 0) scrollBy = overLeft
                else if (overRight > 0) scrollBy = rect.left - overRight < rootRect.left + MARGIN ? overLeft : overRight
                else return
            } else {
                if (overRight > 0) scrollBy = overRight
                else if (overLeft < 0) scrollBy = rect.right - overLeft > rootRect.right - MARGIN ? overRight : overLeft
                else return
            }
        }

        if (scrollBy < 0 && rootEl.scrollLeft === 0) return
        if (scrollBy > 0 && rootEl.scrollWidth <= rootEl.scrollLeft + rootRect.width) return
        this.animateTo(rootEl, scrollBy)
    }

    private animateTo(rootEl: HTMLElement, scrollBy: number): void {
        this.cancelAnimation?.()
        this.cancelAnimation = undefined
        const start = rootEl.scrollLeft
        animate(this.ctrlr.options.scrollAnimationDuration ?? 100, (progress, scheduleNext, cancel) => {
            if (progress >= 1) {
                this.cancelAnimation = undefined
                rootEl.scrollLeft = Math.round(start + scrollBy)
                this.setOverflowClasses()
            } else {
                this.cancelAnimation = cancel
                scheduleNext()
                rootEl.scrollLeft = Math.round(start + progress * scrollBy)
            }
        })
    }
}
