/*********************************************
 * Controller of one MathQuill instance.
 *
 * Owns the edit tree (root block + cursor) and composes the services that
 * connect it to the browser:
 *
 *   editor     – keystrokes, cursor movement, deletion, selection, typing
 *   latex      – LaTeX / text import and export
 *   textarea   – the hidden textarea that receives keyboard and clipboard input
 *   focusBlur  – focus state and listeners
 *   mouse      – click and drag-to-select
 *   scroller   – horizontal scrolling of overflowing fields
 *
 * Every tree change goes through `notify(event)`, which keeps cursor,
 * selection and the services consistent (see `notify`).
 ********************************************/
import { L, R, type Direction } from '../core/direction'
import { domFrag, type DOMFragment } from '../core/domFragment'
import { h } from '../core/dom'
import { linkBlockElement } from '../tree/domLink'
import { Cursor } from '../tree/cursor'
import type { MathBlock } from '../commands/math/core'
import type { Options } from '../options'
import type { HandlerWithDirection, HandlerWithoutDirection } from '../public/types'
import { Editor } from './Editor'
import { LatexIO } from './LatexIO'
import { Textarea } from './Textarea'
import { FocusBlur } from './FocusBlur'
import { Mouse } from './Mouse'
import { Scroller } from './Scroller'

/**
 * What changed, for `notify`:
 * - `move`/`upDown`: the cursor moved (clears the selection)
 * - `edit`: content is about to be edited at the cursor (deletes the selection)
 * - `replace`: the whole content is being replaced
 * - `select`: the selection is being extended
 * - `undefined`: content is about to be typed
 */
export type ControllerEvent = 'move' | 'upDown' | 'replace' | 'edit' | 'select' | undefined

export class Controller {
    readonly id: number
    /** Arbitrary user data, exposed as `mq.data`. */
    readonly data: Record<string, unknown> = {}
    readonly cursor: Cursor
    /** Whether the field can be edited (false for static math and static inner fields). */
    editable = false
    /** Focus state: `false` while focused; `true` or `undefined` (never focused) otherwise. */
    blurred: boolean | undefined
    /** The public API object for this field, passed to handlers. Set by the API layer. */
    api: unknown

    readonly editor: Editor
    readonly latex: LatexIO
    readonly textarea: Textarea
    readonly focusBlur: FocusBlur
    readonly mouse: Mouse
    readonly scroller: Scroller

    /** While muted, handlers are not called (used while rendering the initial content). */
    private muted = false
    /** Original contents of the container, restored by `unmount`. */
    private originalContents: DOMFragment | undefined

    constructor(
        readonly root: MathBlock,
        readonly container: HTMLElement,
        readonly options: Options
    ) {
        this.id = root.id
        root.controller = this
        this.cursor = new Cursor(root, options, this)
        this.editor = new Editor(this)
        this.latex = new LatexIO(this)
        this.textarea = new Textarea(this)
        this.focusBlur = new FocusBlur(this)
        this.mouse = new Mouse(this)
        this.scroller = new Scroller(this)
    }

    // ---- lifecycle ---------------------------------------------------------

    /**
     * Take over the container: its text content is rendered (via `render`)
     * as the initial content, without calling handlers.
     */
    mount(classNames: string, render: (initialText: string) => void): void {
        this.textarea.create()
        const contents = domFrag(this.container).addClass(classNames).children().detach()
        this.originalContents = contents
        const rootEl = h('span', { class: 'mq-root-block' })
        this.container.appendChild(rootEl)
        this.root.setDOM(rootEl)
        linkBlockElement(rootEl, this.root)
        this.withHandlersMuted(() => render(contents.text()))
    }

    /** Static math: not focusable by keyboard, but selectable and copyable. */
    makeStatic(): void {
        this.blurred = true
        this.cursor.hide().parent.blur(this.cursor)
        if (this.options.mouseEvents) {
            this.mouse.attach()
            this.textarea.bindStatic()
        }
    }

    /** Editable math or text field. */
    makeEditable(): void {
        this.editable = true
        this.mouse.attach()
        this.textarea.bindEditable()
    }

    /** Root of a `\MathQuillMathField` inside static math (mouse events come from the outer field). */
    mountInner(): void {
        this.editable = true
        this.textarea.create()
        this.textarea.bindEditable()
        this.cursor.insAtRightEnd(this.root)
    }

    /** Make an inner field read-only, or editable again. */
    setInnerEditable(editable: boolean): void {
        this.editable = editable
        if (editable) {
            this.textarea.bindEditable()
            this.cursor.insAtRightEnd(this.root)
            domFrag(this.container).addClass('mq-editable-field')
        } else {
            this.root.blur()
            this.textarea.unbindEditable()
            this.blurred = true
            domFrag(this.container).removeClass('mq-editable-field')
        }
    }

    /** Restore the container's original contents; returns the container. */
    unmount(): HTMLElement {
        this.cursor.hide()
        this.mouse.detach()
        this.textarea.removeAllListeners()
        this.focusBlur.detach()
        domFrag(this.container).removeClass('mq-editable-field mq-math-mode mq-text-mode').empty()
        if (this.originalContents) domFrag(this.container).append(this.originalContents)
        return this.container
    }

    // ---- events ------------------------------------------------------------

    /** Call the user's handler `name`, with the public API object. */
    handle(name: HandlerWithDirection, dir: Direction): void
    handle(name: HandlerWithoutDirection): void
    handle(name: HandlerWithDirection | HandlerWithoutDirection, dir?: Direction): void {
        if (this.muted) return
        const handlers = this.options.handlers
        const handler = handlers?.[name] as ((...args: unknown[]) => void) | undefined
        if (!handler) return
        if (dir === L || dir === R) handler.call(handlers, dir, this.api)
        else handler.call(handlers, this.api)
    }

    withHandlersMuted(fn: () => void): void {
        const wasMuted = this.muted
        this.muted = true
        try {
            fn()
        } finally {
            this.muted = wasMuted
        }
    }

    /** Announce a change; see `ControllerEvent`. The order of these steps matters. */
    notify(e: ControllerEvent): this {
        const cursor = this.cursor
        this.focusBlur.onNotify(e)
        if (e === 'move' || e === 'upDown') cursor.show().clearSelection()
        if (e !== 'upDown') cursor.upDownCache = {}
        if (e === 'edit') cursor.show().deleteSelection()
        if (e !== 'select') cursor.endSelection()
        this.mouse.onNotify(e)
        return this
    }

    /** The cursor's selection changed: mirror it into the textarea (for copy). */
    onSelectionChanged(): void {
        this.textarea.onSelectionChanged()
    }

    containerHasFocus(): boolean {
        return !!document.activeElement && this.container.contains(document.activeElement)
    }
}
