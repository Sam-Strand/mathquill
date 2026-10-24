/**
 * Runtime options of a MathQuill instance.
 *
 * Options form a prototype chain:  per-field options → global options
 * (`MathQuill.config`) → built-in defaults. Setting a global option affects
 * every field that has not overridden it.
 *
 * Every user-facing config key goes through `applyConfig`, which validates
 * and converts it (e.g. `'pi sqrt'` → dictionary) via `processors`.
 */
import { h } from './core/dom'
import type { Config, Handlers } from './public/types'
import { defaultAutoOperatorNames, operatorNameList, type AutoDict } from './commands/math/operatorNames'

export type { AutoDict }

export interface Options {
    spaceBehavesLikeTab?: boolean
    leftRightIntoCmdGoes?: 'up' | 'down'
    restrictMismatchedBrackets?: boolean
    sumStartsWithNEquals?: boolean
    supSubsRequireOperand?: boolean
    charsThatBreakOutOfSupSub: string
    autoSubscriptNumerals?: boolean
    autoCommands: AutoDict
    autoOperatorNames: AutoDict
    autoParenthesizedFunctions: AutoDict
    quietEmptyDelimiters: Record<string, 1>
    disableAutoSubstitutionInSubscripts?: boolean
    typingSlashCreatesNewFraction?: boolean
    typingSlashWritesDivisionSymbol?: boolean
    typingAsteriskWritesTimesSymbol?: boolean
    typingPercentWritesPercentOf?: boolean
    resetCursorOnBlur?: boolean
    enableDigitGrouping?: boolean
    mouseEvents: boolean
    maxDepth?: number
    disableCopyPaste?: boolean
    statelessClipboard?: boolean
    scrollAnimationDuration: number
    substituteTextarea: () => HTMLElement
    onPaste?: () => void
    onCut?: () => void
    overrideTypedText?: (text: string) => void
    overrideKeystroke?: (key: string, event: KeyboardEvent) => void
    handlers?: Handlers<unknown>
    /** Not a config key: set through `mq.ignoreNextMousedown(fn)`. */
    ignoreNextMousedown: (e: MouseEvent) => boolean
}

const neverIgnore = (_e: MouseEvent) => false

const DEFAULTS: Options = {
    charsThatBreakOutOfSupSub: '',
    autoCommands: { _maxLength: 0 },
    autoOperatorNames: defaultAutoOperatorNames(),
    autoParenthesizedFunctions: { _maxLength: 0 },
    quietEmptyDelimiters: {},
    mouseEvents: true,
    scrollAnimationDuration: 100,
    substituteTextarea: () =>
        h('textarea', {
            autocapitalize: 'off',
            autocomplete: 'off',
            autocorrect: 'off',
            spellcheck: false,
            'x-palm-disable-ste-all': true,
        }),
    ignoreNextMousedown: neverIgnore,
}

/** Options shared by all instances; written by `MathQuill.config()`. */
const globalOptions: Options = Object.create(DEFAULTS)

export function createOptions(): Options {
    return Object.create(globalOptions)
}

export function configureGlobalOptions(config: Config): void {
    applyConfig(globalOptions, config)
}

export function resetIgnoreNextMousedown(options: Options): void {
    options.ignoreNextMousedown = neverIgnore
}

// ---- validation / conversion of config values ---------------------------

const BUILT_IN_OPERATORS = new Set(operatorNameList())

function wordList(value: unknown, what: string): string[] {
    if (typeof value !== 'string' || !/^[a-z]+(?: [a-z]+)*$/i.test(value)) {
        throw new Error('"' + value + '" not a space-delimited list of only letters')
    }
    const list = value.split(' ')
    for (const word of list) {
        if (word.length < 2) throw new Error(what + ' "' + word + '" not minimum length of 2')
    }
    return list
}

function toDict(list: string[], valueOf: (word: string) => string | number = () => 1): AutoDict {
    const dict: AutoDict = {}
    let maxLength = 0
    for (const word of list) {
        dict[word] = valueOf(word)
        maxLength = Math.max(maxLength, word.length)
    }
    dict._maxLength = maxLength
    return dict
}

type Processors = { [K in keyof Config]?: (value: Config[K]) => Options[K & keyof Options] }

const processors: Processors = {
    autoCommands(cmds) {
        const list = wordList(cmds, 'autocommand')
        for (const cmd of list) {
            if (BUILT_IN_OPERATORS.has(cmd)) throw new Error('"' + cmd + '" is a built-in operator name')
        }
        return toDict(list)
    },
    autoParenthesizedFunctions(cmds) {
        return toDict(wordList(cmds, 'autocommand'))
    },
    autoOperatorNames(cmds) {
        if (typeof cmds !== 'string') throw new Error('"' + cmds + '" not a space-delimited list')
        if (!/^[a-z|-]+(?: [a-z|-]+)*$/i.test(cmds)) {
            throw new Error('"' + cmds + '" not a space-delimited list of letters or "|"')
        }
        // `name|spoken-form` entries carry a speech-friendly alternative
        const dict: AutoDict = {}
        let maxLength = 0
        for (const entry of cmds.split(' ')) {
            if (entry.length < 2) throw new Error('"' + entry + '" not minimum length of 2')
            const [name, spoken, ...rest] = entry.split('|')
            if (rest.length) throw new Error('"' + entry + '" has more than 1 mathspeak delimiter')
            if (name.length < 2) throw new Error('"' + name + '" not minimum length of 2')
            dict[name] = spoken === undefined ? name : spoken.replace(/-/g, ' ')
            maxLength = Math.max(maxLength, name.length)
        }
        dict._maxLength = maxLength
        return dict
    },
    quietEmptyDelimiters(dlms = '') {
        const dict: Record<string, 1> = {}
        for (const dlm of dlms.split(' ')) dict[dlm] = 1
        return dict
    },
    leftRightIntoCmdGoes(updown) {
        if (updown && updown !== 'up' && updown !== 'down') {
            throw new Error('"up" or "down" required for leftRightIntoCmdGoes option, got "' + updown + '"')
        }
        return updown
    },
    maxDepth(depth) {
        return typeof depth === 'number' ? depth : undefined
    },
}

/** Copy (validated) config values into `target`. */
export function applyConfig(target: Options, config: Config): void {
    for (const name of Object.keys(config) as (keyof Config)[]) {
        const value = config[name]
        const process = processors[name] as ((v: unknown) => unknown) | undefined
        ;(target as unknown as Record<string, unknown>)[name] = process ? process(value) : value
    }
}
