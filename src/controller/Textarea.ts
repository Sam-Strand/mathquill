/*********************************************
 * The hidden textarea of a field: it has the keyboard focus, receives
 * typed text and clipboard events, and holds the LaTeX of the selection so
 * that the browser's native copy works.
 ********************************************/
import { domFrag } from '../core/domFragment'
import { h } from '../core/dom'
import { cleanLatex } from './LatexIO'
import { bindKeyboardEvents } from './keyboardEvents'
import type { Controller } from './Controller'

export type TextareaListeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void }

export class Textarea {
    /** Usually a <textarea>, but `substituteTextarea` may return another element. */
    element: HTMLElement | undefined
    /** Wrapper span inserted into the field while it is editable. */
    span: HTMLElement | undefined
    private readonly listeners: TextareaListeners = {}
    /** Writes the selection's LaTeX into the textarea (and selects it). */
    private selectFn: (text: string) => void = () => {}
    private selectionTimeout = 0

    constructor(private readonly ctrlr: Controller) {}

    create(): void {
        this.span = h('span', { class: 'mq-textarea' })
        const element = this.ctrlr.options.substituteTextarea()
        if (!element || !element.nodeType) {
            throw new Error('substituteTextarea() must return a DOM element, got ' + element)
        }
        this.span.appendChild(element)
        this.element = element
    }

    getElementOrThrow(): HTMLElement {
        if (!this.element) throw new Error('expected a textarea')
        return this.element
    }

    getSpanOrThrow(): HTMLElement {
        if (!this.span) throw new Error('expected a textarea span')
        return this.span
    }

    focus(): void {
        this.getElementOrThrow().focus()
    }

    blur(): void {
        this.getElementOrThrow().blur()
    }

    // ---- listeners -------------------------------------------------------

    /** Add listeners to the textarea, replacing any previous listener for the same event. */
    addListeners(listeners: TextareaListeners): void {
        const element = this.element
        if (!element) return
        for (const event of Object.keys(listeners) as (keyof HTMLElementEventMap)[]) {
            this.removeListener(event)
            const listener = listeners[event] as EventListener
            ;(this.listeners as Record<string, EventListener>)[event] = listener
            element.addEventListener(event, listener)
        }
    }

    removeListener(event: keyof HTMLElementEventMap): void {
        const listener = this.listeners[event] as EventListener | undefined
        if (!listener || !this.element) return
        this.element.removeEventListener(event, listener)
        delete this.listeners[event]
    }

    // ---- modes -------------------------------------------------------------

    /** Static math: the textarea only serves to copy the selection. */
    bindStatic(): void {
        const ctrlr = this.ctrlr
        this.removeListener('cut')
        this.removeListener('paste')
        if (ctrlr.options.disableCopyPaste) this.removeListener('copy')
        else this.addListeners({ copy: () => this.setTextareaSelection() })
        ctrlr.focusBlur.addStaticListeners()
        this.selectFn = (text) => this.selectPlain(text)
    }

    /** Editable field: keyboard, clipboard and focus handling. */
    bindEditable(): void {
        const ctrlr = this.ctrlr
        const { select } = bindKeyboardEvents(this.getElementOrThrow(), ctrlr)
        this.selectFn = select
        domFrag(ctrlr.container).prepend(domFrag(this.getSpanOrThrow()))
        ctrlr.focusBlur.addEditableListeners()
    }

    removeAllListeners(): void {
        for (const event of Object.keys(this.listeners) as (keyof HTMLElementEventMap)[]) this.removeListener(event)
        this.cancelPendingSelection()
    }

    /** Back from editable to static (inner fields). */
    unbindEditable(): void {
        domFrag(this.getSpanOrThrow()).remove()
        this.removeAllListeners()
        this.selectFn = (text) => this.selectPlain(text)
    }

    private selectPlain(text: string): void {
        const textarea = this.element
        if (!(textarea instanceof HTMLTextAreaElement)) return
        textarea.value = text
        if (text) textarea.select()
    }

    // ---- selection mirroring ---------------------------------------------

    /**
     * Throttled: setting textarea.value / select() can be slow
     * (https://github.com/mathquill/mathquill/issues/43#issuecomment-1399080).
     */
    onSelectionChanged(): void {
        if (!this.selectionTimeout) {
            this.selectionTimeout = window.setTimeout(() => this.setTextareaSelection())
        }
    }

    cancelPendingSelection(): void {
        if (this.selectionTimeout) {
            clearTimeout(this.selectionTimeout)
            this.selectionTimeout = 0
        }
    }

    setTextareaSelection(): void {
        this.selectionTimeout = 0
        const selection = this.ctrlr.cursor.selection
        let latex = ''
        if (selection) {
            latex = cleanLatex(selection.latex())
            // FIXME: like paste, this only works for math fields
            if (this.ctrlr.options.statelessClipboard) latex = '$' + latex + '$'
        }
        this.selectFn(latex)
    }
}
