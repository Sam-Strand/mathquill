import { linkBlockElement } from '../tree/domLink'
import type { MQNode } from '../tree/node'

export type HTMLTagName = 'span' | 'textarea' | 'i' | 'b' | 'big' | 'sup' | 'var' | 'br'
export type SVGTagName = 'svg' | 'path'

export interface ElementAttributes {
    class?: string
    style?: string
    [name: string]: string | boolean | number | undefined
}

type Child = Node

/** Parse an HTML string into a single element, or a DocumentFragment if it has several top-level nodes. */
export function parseHTML(s: string): Element | DocumentFragment {
    const tmp = document.implementation.createHTMLDocument('')
    tmp.body.innerHTML = s
    if (tmp.body.children.length === 1) return tmp.body.children[0]
    const frag = document.createDocumentFragment()
    while (tmp.body.firstChild) frag.appendChild(tmp.body.firstChild)
    return frag
}

function createElement(type: HTMLTagName, attributes?: ElementAttributes, children?: Iterable<Child>): HTMLElement
function createElement(type: SVGTagName, attributes?: ElementAttributes, children?: Iterable<Child>): SVGElement
function createElement(
    type: HTMLTagName | SVGTagName,
    attributes?: ElementAttributes,
    children?: Iterable<Child>
): HTMLElement | SVGElement {
    const el =
        type === 'svg' || type === 'path'
            ? document.createElementNS('http://www.w3.org/2000/svg', type)
            : document.createElement(type)
    for (const key in attributes) {
        const value = attributes[key]
        if (value !== undefined) el.setAttribute(key, String(value))
    }
    if (children) for (const child of Array.from(children)) el.appendChild(child)
    return el
}

/** Hyperscript-style DOM builder. */
export const h = Object.assign(createElement, {
    text(s: string): Text {
        return document.createTextNode(s)
    },

    /** Text node from an HTML entity such as `&rarr;`. */
    entityText(s: string): Text {
        return parseHTML(s).childNodes[0] as Text
    },

    /**
     * Render an element containing a child block, and link the element back
     * to the block so DOM events can find it.
     */
    block(type: HTMLTagName, attributes: ElementAttributes | undefined, block: MQNode): HTMLElement {
        const out = createElement(type, attributes, [block.html()])
        block.setDOM(out)
        linkBlockElement(out, block)
        return out
    },
})

export function closest(el: EventTarget | null, selector: string): Element | null {
    return el instanceof Element ? el.closest(selector) : null
}
