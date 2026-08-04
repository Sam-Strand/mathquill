import type { ConfigOptions, InnerFields } from '../shared_types'
import type { APIClasses, IBaseMathQuill } from '../publicapi'

import { API } from '../registry'
import { MathBlock } from '../commands/math/core'
import { Options } from '../options'
import { MQNode } from '../tree'
import { Controller } from '../services/textarea'

Options.prototype.mouseEvents = true

API.StaticMath = function (APIClasses: APIClasses) {
    return class StaticMath extends APIClasses.AbstractMathQuill {
        innerFields: InnerFields
        static RootBlock = MathBlock

        __mathquillify(opts: ConfigOptions) {
            this.config(opts)
            super.mathquillify('mq-math-mode')
            this.__controller.setupStaticField()
            if (this.__options.mouseEvents) {
                this.__controller.addMouseEventListener()
                this.__controller.staticMathTextareaEvents()
            }
            return this
        }
        constructor(el: Controller) {
            super(el)
            this.innerFields = []
            this.__controller.root.postOrder((node: MQNode) => {
                node.registerInnerField(this.innerFields, APIClasses.InnerMathField)
            })
        }
        latex(s: string): IBaseMathQuill
        latex(): string
        latex(_latex?: string): string | IBaseMathQuill {
            //@ts-ignore
            const returned = super.latex.apply(this, arguments as unknown as any)
            if (arguments.length > 0) {
                this.__controller.root.postOrder( (node: MQNode)=> {
                    node.registerInnerField(this.innerFields, APIClasses.InnerMathField)
                })
            }
            return returned
        }
    }
}
