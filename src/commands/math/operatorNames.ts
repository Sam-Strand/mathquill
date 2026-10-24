/**
 * Operator names (sin, log, lim, ...). Kept in a leaf module because both
 * the option defaults and the Letter command need them.
 */

/** Dictionary of names with the length of the longest one (for scanning letters). */
export type AutoDict = { _maxLength?: number; [name: string]: string | number | undefined }

/**
 * Operator names built into LaTeX (Short Math Guide, section 3.17). Others
 * (e.g. `hcf`, `arsinh`) are exported as `\operatorname{...}`.
 */
export const BUILT_IN_OPERATOR_NAMES: ReadonlySet<string> = new Set(
    (
        'arg deg det dim exp gcd hom inf ker lg lim ln log max min sup limsup liminf injlim projlim Pr ' +
        'sin cos tan arcsin arccos arctan sinh cosh tanh sec csc cot coth'
    ).split(' ')
)

/** Two-word operators whose words are visually separated. */
export const TWO_WORD_OPERATOR_NAMES: ReadonlySet<string> = new Set(['limsup', 'liminf', 'projlim', 'injlim'])

/** Operator names that are un-italicized by default (overridable with the `autoOperatorNames` option). */
export function defaultAutoOperatorNames(): AutoDict {
    const names: AutoDict = { _maxLength: 9 }
    for (const op of 'arg deg det dim exp gcd hom inf ker lg lim ln log max min sup limsup liminf injlim projlim Pr'.split(' ')) {
        names[op] = 1
    }
    for (const trig of 'sin cos tan sec cosec csc cotan cot ctg'.split(' ')) {
        names[trig] = names['arc' + trig] = names[trig + 'h'] = names['ar' + trig + 'h'] = names['arc' + trig + 'h'] = 1
    }
    // compat with nonstandard LaTeX exported by old MathQuill versions
    for (const op of 'gcf hcf lcm proj span'.split(' ')) names[op] = 1
    return names
}

/** Names of the default operators, i.e. those parsed as `\name` operators. */
export function operatorNameList(): string[] {
    return Object.keys(defaultAutoOperatorNames()).filter((k) => k !== '_maxLength')
}
