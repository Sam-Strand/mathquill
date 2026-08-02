//staticMath.ts
import type { ConfigOptions, InnerFields } from './shared_types'
import type { APIClasses, IBaseMathQuill } from './publicapi'

import { API } from './registry'
import { MathBlock } from './commands/math/core'
import { Options } from './options'
import { MQNode } from './tree'
import { Controller } from './services/textarea'

Options.prototype.mouseEvents = true

API.StaticMath = function (APIClasses: APIClasses) {
    return class StaticMath extends APIClasses.AbstractMathQuill {
        innerFields: InnerFields
        static RootBlock = MathBlock

        __mathquillify(opts: ConfigOptions, _interfaceVersion: number) {
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
            var innerFields = (this.innerFields = [])
            this.__controller.root.postOrder(function (node: MQNode) {
                node.registerInnerField(innerFields, APIClasses.InnerMathField)
            })
        }
        latex(s: string): IBaseMathQuill
        latex(): string
        latex(_latex?: string): string | IBaseMathQuill {
            //@ts-ignore
            var returned = super.latex.apply(this, arguments as unknown as any)
            if (arguments.length > 0) {
                var innerFields = (this.innerFields = [])
                this.__controller.root.postOrder(function (node: MQNode) {
                    node.registerInnerField(innerFields, APIClasses.InnerMathField)
                })
                // Force an ARIA label update to remain in sync with the new LaTeX value.
                this.__controller.updateMathspeak()
            }
            return returned
        }
        setAriaLabel(ariaLabel: string) {
            this.__controller.setAriaLabel(ariaLabel)
            return this
        }
        getAriaLabel() {
            return this.__controller.getAriaLabel()
        }
    }
}
