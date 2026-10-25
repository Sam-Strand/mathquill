/**
 * Public types of the MathQuill API.
 * Everything a consumer needs to type their code is exported from here
 * (and re-exported from the package entry).
 */
import type { Direction } from '../core/direction'

export type { Direction }

/** Handlers called with the field that triggered them. */
export interface Handlers<MQ = MathFieldApi> {
    /** Enter was typed */
    enter?(mq: MQ): void
    /** Content changed (also fired as `edited`) */
    edit?(mq: MQ): void
    edited?(mq: MQ): void
    /** Layout-affecting change (fired before `edit`) */
    reflow?(mq: MQ): void
    /** Up/Down pressed at the top/bottom edge */
    upOutOf?(mq: MQ): void
    downOutOf?(mq: MQ): void
    /** Left/Right, Backspace/Del or Shift-Left/Right pressed at an edge */
    moveOutOf?(dir: Direction, mq: MQ): void
    deleteOutOf?(dir: Direction, mq: MQ): void
    selectOutOf?(dir: Direction, mq: MQ): void
}

export type HandlerWithDirection = 'moveOutOf' | 'deleteOutOf' | 'selectOutOf'
export type HandlerWithoutDirection = 'enter' | 'edit' | 'edited' | 'reflow' | 'upOutOf' | 'downOutOf'

/** Options accepted by `MathQuill.MathField(el, config)`, `mq.config()` and `MathQuill.config()`. */
export interface Config {
    spaceBehavesLikeTab?: boolean
    leftRightIntoCmdGoes?: 'up' | 'down'
    restrictMismatchedBrackets?: boolean
    sumStartsWithNEquals?: boolean
    supSubsRequireOperand?: boolean
    charsThatBreakOutOfSupSub?: string
    autoSubscriptNumerals?: boolean
    /** Space-separated list of commands typed without backslash, e.g. `'pi theta sqrt sum'` */
    autoCommands?: string
    /** Space-separated list of operator names, e.g. `'sin cos ln'` */
    autoOperatorNames?: string
    /** Space-separated subset of `autoOperatorNames` that get parentheses automatically */
    autoParenthesizedFunctions?: string
    /** Space-separated list of delimiters (e.g. `'( ['`) whose empty blocks render quietly */
    quietEmptyDelimiters?: string
    disableAutoSubstitutionInSubscripts?: boolean
    typingSlashCreatesNewFraction?: boolean
    typingSlashWritesDivisionSymbol?: boolean
    typingAsteriskWritesTimesSymbol?: boolean
    typingPercentWritesPercentOf?: boolean
    resetCursorOnBlur?: boolean
    enableDigitGrouping?: boolean
    /** Static math only: react to mouse clicks (default true) */
    mouseEvents?: boolean
    maxDepth?: number
    disableCopyPaste?: boolean
    statelessClipboard?: boolean
    scrollAnimationDuration?: number
    substituteTextarea?: () => HTMLElement
    onPaste?: () => void
    onCut?: () => void
    overrideTypedText?: (text: string) => void
    overrideKeystroke?: (key: string, event: KeyboardEvent) => void
    handlers?: Handlers
}

/** What a registered embed renders as. */
export interface EmbedOptions {
    htmlString?: string
    latex?: () => string
}

/** The optional `[data]` of `\embed{name}[data]`. */
export type EmbedOptionsData = string | undefined

/** Methods shared by every MathQuill instance. */
export interface BaseMathQuillApi {
    readonly id: number
    readonly data: Record<string, unknown>
    el(): HTMLElement
    latex(): string
    latex(latex: string): this
    html(): string
    reflow(): this
    config(config: Config): this
    /** Restore the element to its original content and detach MathQuill from it. */
    revert(): HTMLElement
}

export interface StaticMathApi extends BaseMathQuillApi {
    /** Inner `\MathQuillMathField[name]{...}` fields, by index and by name. */
    readonly innerFields: InnerFields
}

export interface InnerFields extends Array<InnerMathFieldApi> {
    [name: string]: unknown
}

export interface MathFieldApi extends BaseMathQuillApi {
    focus(): this
    blur(): this
    /** Insert LaTeX at the cursor. */
    write(latex: string): this
    /** Insert a command (e.g. `'\\sqrt'`) or character at the cursor, wrapping any selection. */
    cmd(cmd: string): this
    select(): this
    clearSelection(): this
    empty(): this
    moveToLeftEnd(): this
    moveToRightEnd(): this
    moveToDirEnd(dir: Direction): this
    /** Simulate keystrokes, e.g. `'Shift-Left Backspace'`. */
    keystroke(keys: string, event?: KeyboardEvent): this
    /** Simulate typing text, character by character. */
    typedText(text: string): this
    dropEmbedded(pageX: number, pageY: number, options: EmbedOptions): this
    clickAt(clientX: number, clientY: number, target?: HTMLElement): this
    ignoreNextMousedown(fn: (e: MouseEvent) => boolean): this
}

export interface InnerMathFieldApi extends MathFieldApi {
    makeStatic(): void
    makeEditable(): void
}

export type TextFieldApi = MathFieldApi
