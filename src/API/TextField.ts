import type { IEditableField, IBaseMathQuill, APIClasses } from '../publicapi'
import { API } from '../registry'
import { RootTextBlock } from '../commands/text'

API.TextField = function (APIClasses: APIClasses) {
    return class TextField extends APIClasses.EditableField {
        static RootBlock = RootTextBlock
        __mathquillify() {
            super.mathquillify('mq-editable-field mq-text-mode')
            return this
        }
        latex(): string
        latex(l: string): IEditableField
        latex(latex?: string) {
            if (latex) {
                this.__controller.renderLatexText(latex)
                if (this.__controller.blurred)
                    this.__controller.cursor.hide().parent.blur()

                const _this: IBaseMathQuill = this; // just to help help TS out
                return _this
            }
            return this.__controller.exportLatex()
        }
    }
}
