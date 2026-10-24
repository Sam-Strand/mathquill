/*********************************************
 * LaTeX and text import / export of a whole field.
 ********************************************/
import { L, R } from '../core/direction'
import { domFrag } from '../core/domFragment'
import { Parser } from '../core/parser'
import type { MQNode } from '../tree/node'
import { MathBlock, VanillaSymbol } from '../commands/math/core'
import { latexMathParser } from '../commands/math/latexParser'
import { Digit, PlusMinus } from '../commands/math/symbols'
import { RootMathCommand } from '../commands/text'
import type { Controller } from './Controller'

/** Remove spaces after control words where they are not needed (`\pi x` stays, `\pi2` → `\pi2`). */
export function cleanLatex(latex: string): string {
    return latex.replace(/(\\[a-z]+) (?![a-z])/gi, '$1')
}

/** `latex` split into a prefix and a trailing (signed) number, e.g. `x+-12` → `x+`, `-12`. */
function splitTrailingNumber(latex: unknown): { prefix: string; digits: string } | undefined {
    if (typeof latex !== 'string') return undefined
    const matches = latex.match(/-?[0-9.]+$/g)
    if (!matches || matches.length !== 1) return undefined
    return { prefix: latex.slice(0, latex.length - matches[0].length), digits: matches[0] }
}

export class LatexIO {
    constructor(private readonly ctrlr: Controller) {}

    exportLatex(): string {
        return cleanLatex(this.ctrlr.root.latex())
    }

    exportText(): string {
        return this.ctrlr.root.foldChildren('', (text, child) => text + child.text())
    }

    /** Insert LaTeX at the cursor. */
    writeLatex(latex: string): void {
        const cursor = this.ctrlr.notify('edit').cursor
        cursor.parent.writeLatex(cursor, latex)
    }

    /** Replace the whole content by `latex` (any value is stringified). Cursor ends up at the end. */
    renderLatexMath(latex: unknown): void {
        const ctrlr = this.ctrlr
        const root = ctrlr.root
        ctrlr.notify('replace')
        ctrlr.cursor.clearSelection()
        const oldLatex = this.exportLatex()
        if (!root.getEnd(L) || !root.getEnd(R) || oldLatex !== latex) {
            if (!this.updateTrailingNumber(latex, oldLatex)) this.renderLatexMathFromScratch(latex)
        }
        ctrlr.cursor.insAtRightEnd(root)
    }

    private renderLatexMathFromScratch(latex: unknown): void {
        const { root, cursor } = this.ctrlr
        const block = latexMathParser.skip(Parser.eof).or(Parser.all.result<false>(false)).parse(latex)
        root.setEnds({ [L]: 0, [R]: 0 })
        if (block) {
            block.children().adopt(root, 0, 0)
            const frag = root.domFrag()
            frag.children().remove()
            frag.oneElement().appendChild(block.html())
            root.finalizeInsert(cursor.options, cursor)
        } else {
            root.domFrag().empty()
        }
    }

    /**
     * Fast path for the common case of a field whose content only differs in
     * a trailing number (e.g. a slider value): update the digits in place
     * instead of re-rendering. Returns false if not applicable.
     */
    private updateTrailingNumber(latex: unknown, oldLatex: string): boolean {
        const { root, cursor } = this.ctrlr
        const next = splitTrailingNumber(latex)
        if (!next) return false
        const prev = splitTrailingNumber(oldLatex)
        if (!prev || prev.prefix !== next.prefix) return false

        let oldDigits = prev.digits
        let newDigits = next.digits
        const oldMinusSign = oldDigits[0] === '-'
        const newMinusSign = newDigits[0] === '-'
        if (oldMinusSign) oldDigits = oldDigits.slice(1)
        if (newMinusSign) newDigits = newDigits.slice(1)

        // collect the trailing digit nodes, which must be direct children of the root
        let charNode = root.getEnd(R)
        const oldCharNodes: MQNode[] = []
        for (let i = oldDigits.length - 1; i >= 0; i--) {
            if (!charNode || charNode.ctrlSeq !== oldDigits[i] || charNode.parent !== root) return false
            oldCharNodes.unshift(charNode)
            charNode = charNode[L]
        }

        // remove the minus sign
        if (oldMinusSign && !newMinusSign) {
            const minus = charNode
            if (!minus || minus.ctrlSeq !== '-' || minus[R] !== oldCharNodes[0] || minus.parent !== root) return false
            const minusL = minus[L]
            if (minusL && minusL.parent !== root) return false
            oldCharNodes[0][L] = minusL
            if (root.getEnd(L) === minus) root.setEnds({ [L]: oldCharNodes[0], [R]: root.getEnd(R) })
            if (minusL) minusL[R] = oldCharNodes[0]
            minus.domFrag().remove()
        }

        // add a minus sign
        if (!oldMinusSign && newMinusSign) {
            const minus = new PlusMinus('-')
            const minusSpan = document.createElement('span')
            minusSpan.textContent = '-'
            minus.setDOM(minusSpan)

            const firstL = oldCharNodes[0][L]
            if (firstL) firstL[R] = minus
            if (root.getEnd(L) === oldCharNodes[0]) root.setEnds({ [L]: minus, [R]: root.getEnd(R) })
            minus.parent = root
            minus[L] = firstL
            minus[R] = oldCharNodes[0]
            oldCharNodes[0][L] = minus
            minus.contactWeld(cursor) // decide whether it is binary
            minus.domFrag().insertBefore(oldCharNodes[0].domFrag())
        }

        // update the digits both have
        const commonLength = Math.min(oldDigits.length, newDigits.length)
        for (let i = 0; i < commonLength; i++) {
            const node = oldCharNodes[i]
            if (node.ctrlSeq !== newDigits[i]) {
                node.ctrlSeq = newDigits[i]
                node.domFrag().oneElement().textContent = newDigits[i]
            }
        }

        // remove extra digits
        if (oldDigits.length > newDigits.length) {
            const last = oldCharNodes[newDigits.length - 1]
            root.setEnds({ [L]: root.getEnd(L), [R]: last })
            last[R] = 0
            for (let i = oldDigits.length - 1; i >= commonLength; i--) oldCharNodes[i].domFrag().remove()
        }

        // append new digits
        if (newDigits.length > oldDigits.length) {
            const frag = document.createDocumentFragment()
            for (let i = commonLength; i < newDigits.length; i++) {
                const span = document.createElement('span')
                span.className = 'mq-digit'
                span.textContent = newDigits[i]
                const digit = new Digit(newDigits[i])
                digit.parent = root
                digit.setDOM(span)
                frag.appendChild(span)
                // splice in at the end
                const prevEnd = root.getEnd(R) as MQNode
                digit[L] = prevEnd
                digit[R] = 0
                prevEnd[R] = digit
                root.setEnds({ [L]: root.getEnd(L), [R]: digit })
            }
            root.domFrag().oneElement().appendChild(frag)
        }

        const currentLatex = this.exportLatex()
        if (currentLatex !== latex) {
            console.warn('tried updating latex efficiently but did not work. Attempted: ' + latex + ' but wrote: ' + currentLatex)
            return false
        }

        const last = root.getEnd(R)
        if (last) last.fixDigitGrouping(cursor.options)
        return true
    }

    /** Replace the whole content of a TextField: text with `$...$` math. */
    renderLatexText(latex: string): void {
        const { root, cursor } = this.ctrlr

        root.domFrag().children().slice(1).remove()
        root.setEnds({ [L]: 0, [R]: 0 })
        cursor.selection = undefined
        cursor.show().insAtRightEnd(root)

        const { regex, string, eof, all } = Parser

        // math mode does not have to end: allow it to run to the end of the input
        const mathMode = string('$')
            .then(latexMathParser)
            .skip(string('$').or(eof))
            .map((block: MathBlock) => {
                const cmd = new RootMathCommand()
                cmd.createBlocks()
                block.children().adopt(cmd.getEnd(L), 0, 0)
                return cmd as MQNode
            })
        const escapedDollar = string('\\$').result('$')
        const textChar = escapedDollar.or(regex(/^[^$]/)).map((ch): MQNode => new VanillaSymbol(ch))
        const commands = mathMode.or(textChar).many().skip(eof).or(all.result<false>(false)).parse(latex)

        if (commands) {
            for (const cmd of commands) cmd.adopt(root, root.getEnd(R), 0)
            domFrag(root.html()).appendTo(root.domFrag().oneElement())
            root.finalizeInsert(cursor.options, cursor)
        }
    }
}
