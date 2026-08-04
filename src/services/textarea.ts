/*********************************************
 * Manage the MathQuill instance's textarea
 * (as owned by the Controller)
 ********************************************/
import { domFrag } from '../domFragment'
import { h } from '../dom'
import { Controller_scrollHoriz } from './scrollHoriz'
import { Options } from '../options'
import { MQNode } from '../tree'
import { saneKeyboardEvents } from './saneKeyboardEvents.util'

Options.prototype.substituteTextarea = function () {
    return h('textarea', {
        autocapitalize: 'off',
        autocomplete: 'off',
        autocorrect: 'off',
        spellcheck: false,
        'x-palm-disable-ste-all': true,
    })
}

class Controller extends Controller_scrollHoriz {
    selectFn: (text: string) => void = () => { }

    createTextarea() {
        this.textareaSpan = h('span', { class: 'mq-textarea' })
        const textarea = this.options.substituteTextarea()
        if (!textarea.nodeType) {
            throw 'substituteTextarea() must return a DOM element, got ' + textarea
        }
        this.textarea = domFrag(textarea)
            .appendTo(this.textareaSpan)
            .oneElement() as HTMLTextAreaElement

        var ctrlr = this
        ctrlr.cursor.selectionChanged = function () {
            ctrlr.selectionChanged()
        }
    }

    selectionChanged() {
        var ctrlr = this

        // throttle calls to setTextareaSelection(), because setting textarea.value
        // and/or calling textarea.select() can have anomalously bad performance:
        // https://github.com/mathquill/mathquill/issues/43#issuecomment-1399080
        //
        // Note, this timeout may be cleared by the blur handler in focusBlur.js
        if (!ctrlr.textareaSelectionTimeout) {
            ctrlr.textareaSelectionTimeout = setTimeout(function () {
                ctrlr.setTextareaSelection()
            })
        }
    }

    setTextareaSelection() {
        this.textareaSelectionTimeout = 0
        var latex = ''
        if (this.cursor.selection) {
            //cleanLatex prunes unnecessary spaces. defined in latex.js
            latex = this.cleanLatex(this.cursor.selection.join('latex'))
            if (this.options.statelessClipboard) {
                // FIXME: like paste, only this works for math fields; should ask parent
                latex = '$' + latex + '$'
            }
        }
        this.selectFn(latex)
    }

    staticMathTextareaEvents() {
        var ctrlr = this
        this.removeTextareaEventListener('cut')
        this.removeTextareaEventListener('paste')
        if (ctrlr.options.disableCopyPaste) {
            this.removeTextareaEventListener('copy')
        } else {
            this.addTextareaEventListeners({
                copy: function () {
                    ctrlr.setTextareaSelection()
                },
            })
        }

        this.addStaticFocusBlurListeners()

        ctrlr.selectFn = function (text: string) {
            const textarea = ctrlr.getTextareaOrThrow()
            if (!(textarea instanceof HTMLTextAreaElement)) return
            textarea.value = text
            if (text) textarea.select()
        }
    }

    editablesTextareaEvents() {
        var ctrlr = this
        const textarea = ctrlr.getTextareaOrThrow()
        const textareaSpan = ctrlr.getTextareaSpanOrThrow()


        const { select } = saneKeyboardEvents(textarea, this)
        this.selectFn = select


        domFrag(this.container).prepend(domFrag(textareaSpan))
        this.addEditableFocusBlurListeners()
    }
    unbindEditablesEvents() {
        var ctrlr = this
        const textarea = ctrlr.getTextareaOrThrow()
        const textareaSpan = ctrlr.getTextareaSpanOrThrow()

        this.selectFn = function (text: string) {
            if (!(textarea instanceof HTMLTextAreaElement)) return
            textarea.value = text
            if (text) textarea.select()
        }
        domFrag(textareaSpan).remove()

        this.removeTextareaEventListener('focus')
        this.removeTextareaEventListener('blur')

        ctrlr.blurred = true
        this.removeTextareaEventListener('cut')
        this.removeTextareaEventListener('paste')
    }
    typedText(ch: string) {
        if (ch === '\n') return this.handle('enter')
        var cursor = this.notify(undefined).cursor
        cursor.parent.write(cursor, ch)
        this.scrollHoriz()
    }
    cut() {
        var ctrlr = this,
            cursor = ctrlr.cursor
        if (cursor.selection) {
            setTimeout(function () {
                ctrlr.notify('edit'); // deletes selection if present
                cursor.parent.bubble(function (node) {
                    (node as MQNode).reflow()
                    return undefined
                })
                if (ctrlr.options && ctrlr.options.onCut) {
                    ctrlr.options.onCut()
                }
            })
        }
    }
    copy() {
        this.setTextareaSelection()
    }
    paste(text: string) {
        // TODO: document `statelessClipboard` config option in README, after
        // making it work like it should, that is, in both text and math mode
        // (currently only works in math fields, so worse than pointless, it
        //  only gets in the way by \text{}-ifying pasted stuff and $-ifying
        //  cut/copied LaTeX)
        if (this.options.statelessClipboard) {
            if (text.slice(0, 1) === '$' && text.slice(-1) === '$') {
                text = text.slice(1, -1)
            } else {
                text = '\\text{' + text + '}'
            }
        }
        // FIXME: this always inserts math or a TextBlock, even in a RootTextBlock
        this.writeLatex(text).cursor.show()
        this.scrollHoriz()
        if (this.options && this.options.onPaste) {
            this.options.onPaste()
        }
    }

    /** Set up for a static MQ field (i.e., initialize the focus state to blurred) */
    setupStaticField() {
        this.blurred = true
        this.cursor.hide().parent.blur(this.cursor)
    }
}

export {
    Controller
}
