/** Scalable SVG glyphs for delimiters and the radical sign. */
import { h } from '../../core/dom'

export interface ScalableSymbol {
    /** CSS width of the glyph box */
    width: string
    html: () => Node
}

export const SVG_SYMBOLS: Record<string, ScalableSymbol> = {
    sqrt: {
        width: '',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '0 0 32 54' }, [
                h('path', {
                    d: 'M0 33 L7 27 L12.5 47 L13 47 L30 0 L32 0 L13 54 L11 54 L4.5 31 L0 33',
                }),
            ]),
    },
    '|': {
        width: '.4em',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '0 0 10 54' }, [
                h('path', { d: 'M4.4 0 L4.4 54 L5.6 54 L5.6 0' }),
            ]),
    },
    '[': {
        width: '.55em',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '0 0 11 24' }, [
                h('path', { d: 'M8 0 L3 0 L3 24 L8 24 L8 23 L4 23 L4 1 L8 1' }),
            ]),
    },
    ']': {
        width: '.55em',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '0 0 11 24' }, [
                h('path', { d: 'M3 0 L8 0 L8 24 L3 24 L3 23 L7 23 L7 1 L3 1' }),
            ]),
    },
    '(': {
        width: '.55em',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '3 0 106 186' }, [
                h('path', {
                    d: 'M85 0 A61 101 0 0 0 85 186 L75 186 A75 101 0 0 1 75 0',
                }),
            ]),
    },
    ')': {
        width: '.55em',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '3 0 106 186' }, [
                h('path', {
                    d: 'M24 0 A61 101 0 0 1 24 186 L34 186 A75 101 0 0 0 34 0',
                }),
            ]),
    },
    '{': {
        width: '.7em',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '10 0 210 350' }, [
                h('path', {
                    d: 'M170 0 L170 6 A47 52 0 0 0 123 60 L123 127 A35 48 0 0 1 88 175 A35 48 0 0 1 123 223 L123 290 A47 52 0 0 0 170 344 L170 350 L160 350 A58 49 0 0 1 102 301 L103 220 A45 40 0 0 0 58 180 L58 170 A45 40 0 0 0 103 130 L103 49 A58 49 0 0 1 161 0',
                }),
            ]),
    },
    '}': {
        width: '.7em',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '10 0 210 350' }, [
                h('path', {
                    d: 'M60 0 L60 6 A47 52 0 0 1 107 60 L107 127 A35 48 0 0 0 142 175 A35 48 0 0 0 107 223 L107 290 A47 52 0 0 1 60 344 L60 350 L70 350 A58 49 0 0 0 128 301 L127 220 A45 40 0 0 1 172 180 L172 170 A45 40 0 0 1 127 130 L127 49 A58 49 0 0 0 70 0',
                }),
            ]),
    },
    '&#8741;': {
        width: '.7em',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '0 0 10 54' }, [
                h('path', { d: 'M3.2 0 L3.2 54 L4 54 L4 0 M6.8 0 L6.8 54 L6 54 L6 0' }),
            ]),
    },
    '&lang;': {
        width: '.55em',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '0 0 10 54' }, [
                h('path', { d: 'M6.8 0 L3.2 27 L6.8 54 L7.8 54 L4.2 27 L7.8 0' }),
            ]),
    },
    '&rang;': {
        width: '.55em',
        html: () =>
            h('svg', { preserveAspectRatio: 'none', viewBox: '0 0 10 54' }, [
                h('path', { d: 'M3.2 0 L6.8 27 L3.2 54 L2.2 54 L5.8 27 L2.2 0' }),
            ]),
    },
}
