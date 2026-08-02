/***********************************************
 * Export math in a human-readable text format
 * As you can see, only half-baked so far.
 **********************************************/
import { ControllerBase } from '../controller'

class Controller_exportText extends ControllerBase {
    exportText() {
        return this.root.foldChildren('', function (text, child) {
            return text + child.text()
        })
    }
}

export {
    Controller_exportText
}
