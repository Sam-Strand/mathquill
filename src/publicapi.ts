
import type { Direction } from './types'
import type { HandlerOptions, LatexCmdsAny, ControllerData, ControllerRoot, ConfigOptions, BaseMathQuill, EditableMathQuill, EmbedOptionsData, EmbedOptions } from './shared_types'
import type { AutoDict } from './options'

import './API'
import './commands/math'

import { L, R, } from './types'
import { NodeBase } from './tree'
import { domFrag } from './domFragment'
import { h } from './dom'
import { MathBlock } from './commands/math/core'
import { getScrollX, getScrollY } from './browser'
import { Controller } from './services/textarea'
import { EmbedNode } from './commands/math/commands'
import { Options, baseOptionProcessors } from './options'
import { API, EMBEDS, LatexCmds } from './registry'

type KIND_OF_MQ = 'StaticMath' | 'MathField' | 'InnerMathField' | 'TextField'

// ============ Internal Interfaces ============
interface InternalMathQuillInstance {
    __controller: Controller
    __options: Options
    id: number
    data: { [key: string]: any }
    mathquillify(classNames: string): void
    __mathquillify(opts: ConfigOptions): IBaseMathQuill
    config(opts: ConfigOptions): IBaseMathQuill
}

interface IBaseMathQuill extends BaseMathQuill, InternalMathQuillInstance { }
interface IBaseMathQuillClass {
    new(ctrlr: Controller): IBaseMathQuill
    RootBlock: typeof MathBlock
}

interface IEditableField extends EditableMathQuill, InternalMathQuillInstance { }
interface IEditableFieldClass {
    new(ctrlr: Controller): IEditableField
    RootBlock: typeof MathBlock
}

interface APIClasses {
    StaticMath?: IBaseMathQuillClass
    MathField?: IEditableFieldClass
    InnerMathField?: IEditableFieldClass
    TextField?: IEditableFieldClass
    AbstractMathQuill: IBaseMathQuillClass
    EditableField: IEditableFieldClass
}

class Progenote {}

// ============ MathQuill API ============
const MathQuill = (() => {
    // Build option processors on top of the shared base
    const optionProcessors = {
        ...baseOptionProcessors,
        handlers: (handlers: HandlerOptions | undefined) => ({
            fns: (handlers as HandlerOptions) || {},
            APIClasses,
        }),
    } as {
        handlers: (handlers: HandlerOptions | undefined) => Options['handlers']
        leftRightIntoCmdGoes?: (updown: 'up' | 'down' | undefined) => 'up' | 'down' | undefined
    }

    function config(currentOptions: Options, newOptions: ConfigOptions) {
        for (const name in newOptions) {
            if (newOptions.hasOwnProperty(name)) {
                const value = (newOptions as any)[name]
                const processor = (optionProcessors as any)[name]
                    ; (currentOptions as any)[name] = processor ? processor(value) : value
            }
        }
    }

    class BaseOptions extends Options { }

    // ============ AbstractMathQuill ============
    abstract class AbstractMathQuill extends Progenote implements IBaseMathQuill {
        __controller: Controller
        __options: Options
        id: number
        data: ControllerData
        abstract revert(): HTMLElement

        constructor(ctrlr: Controller) {
            super()
            this.__controller = ctrlr
            this.__options = ctrlr.options
            this.id = ctrlr.id
            this.data = ctrlr.data
        }

        abstract __mathquillify(opts: ConfigOptions): IBaseMathQuill

        mathquillify(classNames: string) {
            const ctrlr = this.__controller
            const root = ctrlr.root
            const el = ctrlr.container
            ctrlr.createTextarea()

            const contents = domFrag(el).addClass(classNames).children().detach()
            root.setDOM(
                domFrag(h('span', { class: 'mq-root-block' }))
                    .appendTo(el)
                    .oneElement()
            )
            NodeBase.linkElementByBlockNode(root.domFrag().oneElement(), root)
            this.latex(contents.text())

            this.revert = function () {
                ctrlr.removeMouseEventListener()
                domFrag(el)
                    .removeClass('mq-editable-field mq-math-mode mq-text-mode')
                    .empty()
                    .append(contents)
                return el
            }
        }
        config(opts: ConfigOptions) {
            config(this.__options, opts)
            return this
        }

        el() {
            return this.__controller.container
        }

        text() {
            return this.__controller.exportText()
        }

        latex(latex: unknown): typeof this
        latex(): string
        latex(latex?: unknown) {
            if (arguments.length > 0) {
                this.__controller.renderLatexMath(latex)
                const cursor = this.__controller.cursor
                if (this.__controller.blurred) cursor.hide().parent.blur(cursor)
                return this
            }
            return this.__controller.exportLatex()
        }

        html() {
            return this.__controller.root
                .domFrag()
                .oneElement()
                .innerHTML
                .replace(/ mathquill-(?:command|block)-id="?\d+"?/g, '')
                .replace(/<span class="?mq-cursor( mq-blink)?"?>.?<\/span>/i, '')
                .replace(/ mq-hasCursor|mq-hasCursor ?/, '')
                .replace(/ class=(""|(?= |>))/g, '')
        }

        reflow() {
            this.__controller.root.postOrder(function (node) {
                node.reflow()
            })
            return this
        }
    }

    // ============ EditableField ============
    abstract class EditableField extends AbstractMathQuill implements IEditableField {
        mathquillify(classNames: string) {
            super.mathquillify(classNames)
            this.__controller.editable = true
            this.__controller.addMouseEventListener()
            this.__controller.editablesTextareaEvents()
            return this
        }

        focus() {
            this.__controller.getTextareaOrThrow().focus()
            this.__controller.scrollHoriz()
            return this
        }

        blur() {
            this.__controller.getTextareaOrThrow().blur()
            return this
        }

        write(latex: string) {
            this.__controller.writeLatex(latex)
            this.__controller.scrollHoriz()
            const cursor = this.__controller.cursor
            if (this.__controller.blurred) cursor.hide().parent.blur(cursor)
            return this
        }

        empty() {
            const root = this.__controller.root
            const cursor = this.__controller.cursor

            root.setEnds({ [L]: 0, [R]: 0 })
            root.domFrag().empty()
            delete cursor.selection
            cursor.insAtRightEnd(root)
            return this
        }

        cmd(cmd: string) {
            const ctrlr = this.__controller.notify(undefined)
            const cursor = ctrlr.cursor

            if (/^\\[a-z]+$/i.test(cmd) && !cursor.isTooDeep()) {
                cmd = cmd.slice(1)
                const klass = (LatexCmds as LatexCmdsAny)[cmd]
                let node
                if (klass) {
                    if (klass.constructor) {
                        node = new klass(cmd)
                    } else {
                        node = klass(cmd)
                    }
                    if (cursor.selection) node.replaces(cursor.replaceSelection())
                    node.createLeftOf(cursor.show())
                }
            } else {
                cursor.parent.write(cursor, cmd)
            }

            ctrlr.scrollHoriz()
            if (ctrlr.blurred) cursor.hide().parent.blur(cursor)
            return this
        }

        select() {
            this.__controller.selectAll()
            return this
        }

        clearSelection() {
            this.__controller.cursor.clearSelection()
            return this
        }

        moveToDirEnd(dir: Direction) {
            this.__controller
                .notify('move')
                .cursor.insAtDirEnd(dir, this.__controller.root)
            return this
        }

        moveToLeftEnd() {
            return this.moveToDirEnd(L)
        }

        moveToRightEnd() {
            return this.moveToDirEnd(R)
        }

        keystroke(keysString: string, evt?: KeyboardEvent) {
            const keys = keysString.replace(/^\s+|\s+$/g, '').split(/\s+/)
            for (let i = 0; i < keys.length; i += 1) {
                this.__controller.keystroke(keys[i], evt)
            }
            return this
        }

        typedText(text: string) {
            for (let i = 0; i < text.length; i += 1) {
                this.__controller.typedText(text.charAt(i))
            }
            return this
        }

        dropEmbedded(pageX: number, pageY: number, options: EmbedOptions) {
            const clientX = pageX - getScrollX()
            const clientY = pageY - getScrollY()

            const el = document.elementFromPoint(clientX, clientY)
            this.__controller.seek(el, clientX, clientY)
            const cmd = new EmbedNode().setOptions(options)
            cmd.createLeftOf(this.__controller.cursor)
        }

        clickAt(clientX: number, clientY: number, target?: HTMLElement) {
            const el = document.elementFromPoint(clientX, clientY)
            if (el instanceof HTMLElement) target = target || el
            const ctrlr = this.__controller
            const root = ctrlr.root
            const rootElement = root.domFrag().oneElement()
            if (!target || !rootElement.contains(target)) target = rootElement
            ctrlr.seek(target, clientX, clientY)
            if (ctrlr.blurred) this.focus()
            return this
        }

        ignoreNextMousedown(fn: Options['ignoreNextMousedown']) {
            this.__controller.cursor.options.ignoreNextMousedown = fn
            return this
        }
    }

    // ============ APIClasses ============
    const APIClasses: APIClasses = {
        AbstractMathQuill,
        EditableField,
    } as unknown as APIClasses

    APIClasses.StaticMath = API.StaticMath(APIClasses)
    APIClasses.MathField = API.MathField(APIClasses)
    APIClasses.InnerMathField = API.InnerMathField(APIClasses)

    if (API.TextField) {
        APIClasses.TextField = API.TextField(APIClasses)
    }

    // ============ MQ ============
    const MQ = function (el: HTMLElement) {
        if (!el || !el.nodeType) return null

        let blockElement
        const childArray = domFrag(el).children().toElementArray()
        for (const child of childArray) {
            if (child.classList.contains('mq-root-block')) {
                blockElement = child
                break
            }
        }

        const blockNode = NodeBase.getNodeOfElement(blockElement) as MathBlock
        const ctrlr = blockNode && (blockNode as any).controller
        const APIClass = ctrlr && APIClasses[ctrlr.KIND_OF_MQ as KIND_OF_MQ]
        return ctrlr && APIClass ? new APIClass(ctrlr) : null
    }

    MQ.L = L
    MQ.R = R

    MQ.config = function (opts: ConfigOptions) {
        config(BaseOptions.prototype, opts)
        return this
    }

    MQ.registerEmbed = function (
        name: string,
        options: (data: EmbedOptionsData) => EmbedOptions
    ) {
        if (!/^[a-z][a-z0-9]*$/i.test(name)) {
            throw 'Embed name must start with letter and be only letters and digits'
        }
        EMBEDS[name] = options
    }

    // ============ Entrypoint Factory ============
    function createEntrypoint<
        K extends keyof typeof API,
        MQClass extends IBaseMathQuillClass | IEditableFieldClass
    >(kind: K, APIClass: MQClass) {
        function mqEntrypoint(el: null | undefined): null
        function mqEntrypoint(el: HTMLElement, config?: ConfigOptions): InstanceType<MQClass>
        function mqEntrypoint(el?: HTMLElement | null, opts?: ConfigOptions) {
            if (!el || !el.nodeType) return null

            const mq = MQ(el)
            if (mq instanceof APIClass) return mq

            const ctrlr = new Controller(
                new APIClass.RootBlock() as ControllerRoot,
                el,
                new BaseOptions()
            )
            ctrlr.KIND_OF_MQ = kind as any
            return new APIClass(ctrlr).__mathquillify(opts || {})
        }
        mqEntrypoint.prototype = APIClass.prototype
        return mqEntrypoint
    }

    // ============ Export API ============
    MQ.StaticMath = createEntrypoint('StaticMath', APIClasses.StaticMath!)
    MQ.MathField = createEntrypoint('MathField', APIClasses.MathField!)
    MQ.InnerMathField = createEntrypoint('InnerMathField', APIClasses.InnerMathField!)
    if (APIClasses.TextField) {
        MQ.TextField = createEntrypoint('TextField', APIClasses.TextField)
    }

    MQ.prototype = AbstractMathQuill.prototype
        ; (MQ as any).EditableField = function () {
            throw "wtf don't call me, I'm 'abstract'"
        }
        ; (MQ as any).EditableField.prototype = EditableField.prototype
    return MQ as any
})()

export {
    MathQuill
}

export type {
    AutoDict,
    KIND_OF_MQ,
    APIClasses,
    IEditableField,
    IBaseMathQuill,
}
