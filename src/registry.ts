import type { EmbedOptionsData, EmbedOptions } from './shared_types'

// Конструкторы API-классов будут добавляться другими модулями
export interface APIClasses {
    StaticMath?: any
    MathField?: any
    InnerMathField?: any
    TextField?: any
    AbstractMathQuill: any
    EditableField: any
}

export type APIClassBuilders = {
    StaticMath?: (APIClasses: APIClasses) => any
    MathField?: (APIClasses: APIClasses) => any
    InnerMathField?: (APIClasses: APIClasses) => any
    TextField?: (APIClasses: APIClasses) => any
}

export const API: APIClassBuilders = {}
export const EMBEDS: Record<string, (data: EmbedOptionsData) => EmbedOptions> = {}
