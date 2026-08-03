import type { HandlerOptions,  ConfigOptions } from './shared_types'
import type { APIClasses } from './publicapi'

/** Dictionary type used for auto-commands, operator names, etc. */
export type AutoDict = { _maxLength?: number;[id: string]: any }

/**
 * Configuration options for a MathQuill instance.
 * All properties are optional except `version` and `substituteTextarea`
 * (the latter is always set by the controller).
 */
export class Options {
    version: 3 = 3

    ignoreNextMousedown?: (_el: MouseEvent) => boolean
    substituteTextarea!: () => HTMLElement

    restrictMismatchedBrackets?: boolean
    typingSlashCreatesNewFraction?: boolean
    charsThatBreakOutOfSupSub: string = ''
    sumStartsWithNEquals?: boolean
    autoSubscriptNumerals?: boolean
    supSubsRequireOperand?: boolean
    spaceBehavesLikeTab?: boolean
    typingAsteriskWritesTimesSymbol?: boolean
    typingSlashWritesDivisionSymbol: boolean = false
    typingPercentWritesPercentOf?: boolean
    resetCursorOnBlur?: boolean
    leftRightIntoCmdGoes?: 'up' | 'down'
    enableDigitGrouping?: boolean
    mouseEvents?: boolean
    maxDepth?: number
    disableCopyPaste?: boolean
    statelessClipboard?: boolean
    onPaste?: () => void
    onCut?: () => void
    overrideTypedText?: (text: string) => void
    overrideKeystroke?: (key: string, event: KeyboardEvent) => void
    autoOperatorNames: AutoDict = {}
    autoCommands: AutoDict = {}
    autoParenthesizedFunctions: AutoDict = {}
    quietEmptyDelimiters: { [id: string]: any } = {}
    disableAutoSubstitutionInSubscripts?: boolean
    handlers?: { fns: HandlerOptions; APIClasses: APIClasses }
    scrollAnimationDuration?: number = 100
}

/** Options that require special processing (validation, transformation). */
export const processedOptions = {
    handlers: true,
    autoCommands: true,
    quietEmptyDelimiters: true,
    autoParenthesizedFunctions: true,
    autoOperatorNames: true,
    leftRightIntoCmdGoes: true,
    maxDepth: true,
} as const

export type ProcessedOption = keyof typeof processedOptions

/** Map of processing functions for specific options. */
export type OptionProcessors = Partial<{
    [K in ProcessedOption]: (optionValue: ConfigOptions[K]) => Options[K]
}>

/**
 * Base option processors that are shared across all MathQuill instances.
 * Additional processors (like `handlers`) are added in `publicapi.ts`.
 */
export const baseOptionProcessors: OptionProcessors = {
    leftRightIntoCmdGoes(updown) {
        if (updown && updown !== 'up' && updown !== 'down') {
            throw new Error(
                `"up" or "down" required for leftRightIntoCmdGoes option, got "${updown}"`
            )
        }
        return updown
    },
    maxDepth(depth: number | undefined) {
        return typeof depth === 'number' ? depth : undefined;
    },
}
