/**
 * The `MathQuill` object: entry points and global configuration.
 *
 *   MathQuill(el)                  → the MathQuill object of `el`, or null
 *   MathQuill.StaticMath(el, cfg?) → static math (idempotent)
 *   MathQuill.MathField(el, cfg?)  → editable math (idempotent)
 *   MathQuill.TextField(el, cfg?)  → editable text with $math$ (experimental)
 *   MathQuill.config(cfg)          → defaults for all fields
 *   MathQuill.registerEmbed(name, fn)
 */
import '../commands'
import { L, R } from '../core/direction'
import { nodeOfElement } from '../tree/domLink'
import { embeds } from '../commands/registry'
import type { MathBlock } from '../commands/math/core'
import { configureGlobalOptions } from '../options'
import { AbstractMathQuill, EditableField, InnerMathField, MathField, StaticMath, TextField } from './api'
import type { Config, EmbedOptions, EmbedOptionsData } from './types'

/** The MathQuill object previously created on `el`, if any. */
function getInstance(el: HTMLElement | null | undefined): AbstractMathQuill | null {
    if (!el || !el.nodeType) return null
    const rootEl = Array.from(el.children).find((child) => child.classList.contains('mq-root-block'))
    const root = nodeOfElement(rootEl) as MathBlock | undefined
    const api = root?.controller?.api
    return api instanceof AbstractMathQuill ? api : null
}

type FieldClass<T extends AbstractMathQuill> = abstract new (...args: never[]) => T

/**
 * Entry point creating fields of class `Kind` (or returning the existing one).
 * `entry.prototype` is the class prototype, so `mq instanceof MathQuill.MathField` works.
 */
function entryPoint<T extends AbstractMathQuill>(Kind: FieldClass<T>, create: (el: HTMLElement, config: Config) => T) {
    function entry(el: null | undefined): null
    function entry(el: HTMLElement, config?: Config): T
    function entry(el?: HTMLElement | null, config?: Config): T | null {
        if (!el || !el.nodeType) return null
        const existing = getInstance(el)
        if (existing instanceof Kind) return existing
        return create(el, config || {})
    }
    entry.prototype = Kind.prototype
    return entry
}

export const MathQuill = Object.assign(getInstance, {
    L,
    R,
    StaticMath: entryPoint(StaticMath, (el, config) => StaticMath.create(el, config)),
    MathField: entryPoint(MathField, (el, config) => MathField.create(el, config)),
    InnerMathField: entryPoint(InnerMathField, (el, config) => InnerMathField.create(el, config)),
    TextField: entryPoint(TextField, (el, config) => TextField.create(el, config)),
    /** For `instanceof` checks only. */
    EditableField: abstractClassRef(EditableField),

    /** Set options for all fields (those that don't override them). */
    config(config: Config) {
        configureGlobalOptions(config)
        return MathQuill
    },

    registerEmbed(name: string, options: (data: EmbedOptionsData) => EmbedOptions): void {
        if (!/^[a-z][a-z0-9]*$/i.test(name)) {
            throw new Error('Embed name must start with letter and be only letters and digits')
        }
        embeds.set(name, options)
    },
})
getInstance.prototype = AbstractMathQuill.prototype

/** A function that cannot be called, with the prototype of `cls` (for `instanceof`). */
function abstractClassRef(cls: { prototype: object }) {
    const ref = function () {
        throw new Error('EditableField is abstract; use MathQuill.MathField')
    }
    ref.prototype = cls.prototype
    return ref
}

export type MathQuillStatic = typeof MathQuill
