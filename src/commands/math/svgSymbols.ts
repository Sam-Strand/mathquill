/** Scalable SVG glyphs for delimiters and the radical sign (data in svg-symbols.mkon). */
import { h } from '../../core/dom'
import config from './svg-symbols.mkon'

export interface ScalableSymbol {
    /** CSS width of the glyph box */
    width: string
    html: () => Node
}

export const SVG_SYMBOLS: Record<string, ScalableSymbol> = {}

for (const { id, width, viewBox, d } of config.symbols) {
    SVG_SYMBOLS[id] = {
        width,
        html: () => h('svg', { preserveAspectRatio: 'none', viewBox }, [h('path', { d })]),
    }
}
