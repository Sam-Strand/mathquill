/**
 * Like `el.getBoundingClientRect()` but safely handles disconnected/hidden elements.
 * In modern browsers, getBoundingClientRect() no longer throws for disconnected elements.
 */
function getBoundingClientRect(el: HTMLElement): DOMRect {
    // Проверка на отсоединенные или скрытые элементы
    // getClientRects() возвращает пустую коллекцию для display:none
    if (!el.isConnected || !el.getClientRects().length) {
        return new DOMRect(0, 0, 0, 0)
    }
    
    return el.getBoundingClientRect()
}

/**
 * Returns horizontal scroll position of the document.
 * Modern browsers support window.scrollX directly.
 */
function getScrollX(): number {
    return window.scrollX ?? window.pageXOffset ?? 0
}

/**
 * Returns vertical scroll position of the document.
 * Modern browsers support window.scrollY directly.
 */
function getScrollY(): number {
    return window.scrollY ?? window.pageYOffset ?? 0
}

export {
    getBoundingClientRect,
    getScrollX,
    getScrollY,
}