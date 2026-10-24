/**
 * The objects returned by `MathQuill.StaticMath(el)`, `MathQuill.MathField(el)`, ...
 * Thin wrappers that translate the public API into controller calls.
 */
import { L, R, type Direction } from '../core/direction'
import { getScrollX, getScrollY } from '../core/geometry'
import { Controller } from '../controller/Controller'
import { MathBlock, RootMathBlock } from '../commands/math/core'
import { RootTextBlock } from '../commands/text'
import { EmbedNode } from '../commands/math/embed'
import { applyConfig, createOptions } from '../options'
import type {
    BaseMathQuillApi,
    Config,
    EmbedOptions,
    InnerFields,
    InnerMathFieldApi,
    MathFieldApi,
    StaticMathApi,
} from './types'

/** Base class of all MathQuill objects. */
export abstract class AbstractMathQuill implements BaseMathQuillApi {
    readonly id: number
    readonly data: Record<string, unknown>

    constructor(protected readonly controller: Controller) {
        this.id = controller.id
        this.data = controller.data
        controller.api = this
    }

    /** Create the controller for a new field on `el` (empty options, chain to global options). */
    protected static createController(el: HTMLElement, root: MathBlock): Controller {
        return new Controller(root, el, createOptions())
    }

    protected mount(classNames: string): void {
        this.controller.mount(classNames, (text) => this.latex(text))
    }

    config(config: Config): this {
        applyConfig(this.controller.options, config)
        return this
    }

    el(): HTMLElement {
        return this.controller.container
    }

    text(): string {
        return this.controller.latex.exportText()
    }

    latex(): string
    latex(latex: unknown): this
    latex(latex?: unknown): string | this {
        if (arguments.length === 0) return this.controller.latex.exportLatex()
        this.controller.latex.renderLatexMath(latex)
        this.controller.editor.hideCursorIfBlurred()
        return this
    }

    html(): string {
        return this.controller.root
            .domFrag()
            .oneElement()
            .innerHTML.replace(/<span class="?mq-cursor( mq-blink)?"?>.?<\/span>/i, '')
            .replace(/ mq-hasCursor|mq-hasCursor ?/, '')
            .replace(/ class=(""|(?= |>))/g, '')
    }

    reflow(): this {
        this.controller.root.postOrder((node) => node.reflow())
        return this
    }

    revert(): HTMLElement {
        return this.controller.unmount()
    }
}

/** A field without an editable cursor; may contain editable inner fields. */
export class StaticMath extends AbstractMathQuill implements StaticMathApi {
    readonly innerFields: InnerFields = [] as unknown as InnerFields

    constructor(controller: Controller) {
        super(controller)
        this.collectInnerFields()
    }

    static create(el: HTMLElement, config: Config): StaticMath {
        const mq = new StaticMath(AbstractMathQuill.createController(el, new MathBlock()))
        mq.config(config)
        mq.mount('mq-math-mode')
        mq.controller.makeStatic()
        return mq
    }

    latex(): string
    latex(latex: unknown): this
    latex(latex?: unknown): string | this {
        if (arguments.length === 0) return super.latex()
        super.latex(latex)
        this.collectInnerFields()
        return this
    }

    /** (Re)build `innerFields` from the `\MathQuillMathField`s in the tree. */
    private collectInnerFields(): void {
        const fields = this.innerFields
        for (const key of Object.keys(fields)) delete (fields as unknown as Record<string, unknown>)[key]
        fields.length = 0
        this.controller.root.postOrder((node) =>
            node.registerInnerField({
                add(name, controller) {
                    const field = (controller.api as InnerMathField | undefined) ?? new InnerMathField(controller)
                    if (name !== undefined) fields[name] = field
                    fields.push(field)
                },
            })
        )
    }
}

/** Shared implementation of editable fields (math and text). */
export abstract class EditableField extends AbstractMathQuill implements MathFieldApi {
    protected mount(classNames: string): void {
        super.mount(classNames)
        this.controller.makeEditable()
    }

    focus(): this {
        this.controller.textarea.focus()
        this.controller.scroller.scrollHoriz()
        return this
    }

    blur(): this {
        this.controller.textarea.blur()
        return this
    }

    write(latex: string): this {
        this.controller.editor.write(latex)
        return this
    }

    cmd(cmd: string): this {
        this.controller.editor.cmd(cmd)
        return this
    }

    empty(): this {
        const { root, cursor } = this.controller
        root.setEnds({ [L]: 0, [R]: 0 })
        root.domFrag().empty()
        cursor.selection = undefined
        cursor.insAtRightEnd(root)
        return this
    }

    select(): this {
        this.controller.editor.selectAll()
        return this
    }

    clearSelection(): this {
        this.controller.cursor.clearSelection()
        return this
    }

    moveToDirEnd(dir: Direction): this {
        this.controller.notify('move').cursor.insAtDirEnd(dir, this.controller.root)
        return this
    }

    moveToLeftEnd(): this {
        return this.moveToDirEnd(L)
    }

    moveToRightEnd(): this {
        return this.moveToDirEnd(R)
    }

    keystroke(keys: string, evt?: KeyboardEvent): this {
        for (const key of keys.trim().split(/\s+/)) this.controller.editor.keystroke(key, evt)
        return this
    }

    typedText(text: string): this {
        for (const ch of text) this.controller.editor.typedText(ch)
        return this
    }

    dropEmbedded(pageX: number, pageY: number, options: EmbedOptions): this {
        const clientX = pageX - getScrollX()
        const clientY = pageY - getScrollY()
        this.controller.mouse.seek(document.elementFromPoint(clientX, clientY), clientX, clientY)
        new EmbedNode().setOptions(options).createLeftOf(this.controller.cursor)
        return this
    }

    clickAt(clientX: number, clientY: number, target?: HTMLElement): this {
        const el = document.elementFromPoint(clientX, clientY)
        if (el instanceof HTMLElement) target = target || el
        const rootElement = this.controller.root.domFrag().oneElement()
        if (!target || !rootElement.contains(target)) target = rootElement
        this.controller.mouse.seek(target, clientX, clientY)
        if (this.controller.blurred) this.focus()
        return this
    }

    ignoreNextMousedown(fn: (e: MouseEvent) => boolean): this {
        this.controller.options.ignoreNextMousedown = fn
        return this
    }
}

export class MathField extends EditableField {
    static create<T extends MathField>(this: new (controller: Controller) => T, el: HTMLElement, config: Config): T {
        const mq = new this(AbstractMathQuill.createController(el, new RootMathBlock()))
        mq.config(config)
        mq.mount('mq-editable-field mq-math-mode')
        return mq
    }
}

/** An editable `\MathQuillMathField` inside static math. */
export class InnerMathField extends MathField implements InnerMathFieldApi {
    makeStatic(): void {
        this.controller.setInnerEditable(false)
    }

    makeEditable(): void {
        this.controller.setInnerEditable(true)
    }
}

/** Plain text with `$...$` math (experimental). */
export class TextField extends EditableField {
    static create(el: HTMLElement, config: Config): TextField {
        const mq = new TextField(AbstractMathQuill.createController(el, new RootTextBlock()))
        mq.config(config)
        mq.mount('mq-editable-field mq-text-mode')
        return mq
    }

    latex(): string
    latex(latex: unknown): this
    latex(latex?: unknown): string | this {
        if (arguments.length === 0) return this.controller.latex.exportLatex()
        if (latex) {
            this.controller.latex.renderLatexText(String(latex))
            this.controller.editor.hideCursorIfBlurred()
        }
        return this
    }
}
