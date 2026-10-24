import type { MQNode } from './node'

/**
 * Links from rendered DOM elements back to the tree nodes that rendered them.
 * Used by event handlers (mouse seek) and by `MathQuill(el)` to find the
 * instance behind an element. WeakMaps keep the DOM free of expando props.
 */
const blockNodes = new WeakMap<Element, MQNode>()
const commandNodes = new WeakMap<Element, MQNode>()

export function linkBlockElement(el: Element, node: MQNode): void {
    blockNodes.set(el, node)
}

export function linkCommandElement(el: Element, node: MQNode): void {
    commandNodes.set(el, node)
}

/** The block node rendered by `el`, falling back to the command node. */
export function nodeOfElement(el: Element | null | undefined): MQNode | undefined {
    if (!el) return undefined
    return blockNodes.get(el) ?? commandNodes.get(el)
}
