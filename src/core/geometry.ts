/**
 * Like `el.getBoundingClientRect()`, but returns an empty rect for
 * disconnected or `display:none` elements instead of stale values.
 */
export function getBoundingClientRect(el: Element): DOMRect {
    if (!el.isConnected || !el.getClientRects().length) return new DOMRect(0, 0, 0, 0)
    return el.getBoundingClientRect()
}

export function getScrollX(): number {
    return window.scrollX
}

export function getScrollY(): number {
    return window.scrollY
}
