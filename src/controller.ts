import type { Direction } from './types'
import type { ControllerEvent, ControllerRoot, ControllerData, HandlersWithoutDirection, HandlerOptions, HandlersWithDirection } from './shared_types'
import type { Controller } from './services/textarea'

import { L, R } from './types'
import { Cursor } from './cursor'
import { KIND_OF_MQ } from './publicapi'
import { Options } from './options'

type TextareaKeyboardEventListeners = Partial<{
    [K in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[K]) => any
}>

/*********************************************
 * Controller for a MathQuill instance
 ********************************************/

type HandlerWithDirectionFunction = NonNullable<
    HandlerOptions[HandlersWithDirection]
>
type HandlerWithoutDirectionFunction = NonNullable<
    HandlerOptions[HandlersWithoutDirection]
>

class ControllerBase {
    id: number
    data: ControllerData
    readonly cursor: Cursor
    editable: boolean | undefined
    KIND_OF_MQ: KIND_OF_MQ

    textarea: HTMLElement | undefined
    textareaEventListeners: Partial<{
        [K in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[K]) => any
    }> = {}

    textareaSpan: HTMLElement | undefined

    constructor(
        readonly root: ControllerRoot,
        readonly container: HTMLElement,
        readonly options: Options
    ) {
        this.id = root.id
        this.data = {}

        root.controller = this.getControllerSelf()

        this.cursor = root.cursor = new Cursor(
            root,
            options,
            this.getControllerSelf()
        )
        // TODO: stop depending on root.cursor, and rm it
    }

    getControllerSelf() {
        // dance we have to do to tell this thing it's a full controller
        return this as any as Controller
    }

    handle(name: HandlersWithDirection, dir: Direction): void
    handle(name: HandlersWithoutDirection): void
    handle(
        name: HandlersWithDirection | HandlersWithoutDirection,
        dir?: Direction
    ) {
        var handlers = this.options.handlers
        const handler = this.options.handlers?.fns[name]
        if (handler) {
            const APIClass = handlers?.APIClasses[this.KIND_OF_MQ]
            var mq = new APIClass(this as any); // cast to any bedcause APIClass needs the final Controller subclass.
            if (dir === L || dir === R)
                (handler as HandlerWithDirectionFunction)(dir, mq)
            else (handler as HandlerWithoutDirectionFunction)(mq)
        }
    }

    static notifyees: ((cursor: Cursor, e: ControllerEvent) => void)[] = []
    static onNotify(f: (cursor: Cursor, e: ControllerEvent) => void) {
        ControllerBase.notifyees.push(f)
    }
    notify(e: ControllerEvent) {
        for (var i = 0; i < ControllerBase.notifyees.length; i += 1) {
            ControllerBase.notifyees[i](this.cursor, e)
        }
        return this
    }
    containerHasFocus() {
        return (
            document.activeElement && this.container.contains(document.activeElement)
        )
    }

    getTextareaOrThrow() {
        var textarea = this.textarea
        if (!textarea) throw new Error('expected a textarea')
        return textarea
    }

    getTextareaSpanOrThrow() {
        var textareaSpan = this.textareaSpan
        if (!textareaSpan) throw new Error('expected a textareaSpan')
        return textareaSpan
    }

    /** Add the given event listeners on this.textarea, replacing the existing listener for that event if it exists. */
    addTextareaEventListeners(listeners: TextareaKeyboardEventListeners) {
        if (!this.textarea) return
        for (const key in listeners) {
            const event = key as keyof typeof listeners
            this.removeTextareaEventListener(event)
            this.textarea.addEventListener(event, listeners[event] as EventListener)
        }
    }

    removeTextareaEventListener(event: keyof HTMLElementEventMap) {
        if (!this.textarea) return
        const listener = this.textareaEventListeners[event]
        if (!listener) return
        this.textarea.removeEventListener(event, listener as EventListener)
    }

    // overridden
    scrollHoriz() { }
    selectionChanged() { }
    setOverflowClasses() { }
}

export {
    ControllerBase
}
