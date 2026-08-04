import type { APIClasses } from '../publicapi'

import { API } from '../registry'
import { domFrag } from '../domFragment'

API.InnerMathField = function (APIClasses: APIClasses) {
    return class extends APIClasses.MathField {
        makeStatic() {
            this.__controller.editable = false
            this.__controller.root.blur()
            this.__controller.unbindEditablesEvents()
            domFrag(this.__controller.container).removeClass('mq-editable-field')
        }
        makeEditable() {
            this.__controller.editable = true
            this.__controller.editablesTextareaEvents()
            this.__controller.cursor.insAtRightEnd(this.__controller.root)
            domFrag(this.__controller.container).addClass('mq-editable-field')
        }
    }
}
