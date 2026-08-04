import type { ConfigOptions } from '../shared_types'
import type { APIClasses } from '../publicapi'

import { RootMathBlock } from '../commands/math/core'
import { API } from '../registry'

API.MathField = function (APIClasses: APIClasses) {
    return class MathField extends APIClasses.EditableField {
        static RootBlock = RootMathBlock

        __mathquillify(opts: ConfigOptions) {
            this.config(opts)
            this.__controller.root.reflow = () => { }
            super.mathquillify('mq-editable-field mq-math-mode')
            // TODO: Why does this need to be deleted (contrary to the type definition)? Could we set it to `noop` instead?
            delete (this.__controller.root as any).reflow
            return this
        }
    }
}
