import type { Direction } from './types'
import type { RootBlockMixinInput } from './shared_types'

import { pray } from './utils'

export function RootBlockMixin(_: RootBlockMixinInput) {
    _.moveOutOf = function (dir: Direction) {
        pray('controller is defined', this.controller)
        this.controller.handle('moveOutOf', dir)
    }
    _.deleteOutOf = function (dir: Direction) {
        pray('controller is defined', this.controller)
        this.controller.handle('deleteOutOf', dir)
    }
    _.selectOutOf = function (dir: Direction) {
        pray('controller is defined', this.controller)
        this.controller.handle('selectOutOf', dir)
    }
    _.upOutOf = function () {
        pray('controller is defined', this.controller)
        this.controller.handle('upOutOf')
        return undefined
    }
    _.downOutOf = function () {
        pray('controller is defined', this.controller)
        this.controller.handle('downOutOf')
        return undefined
    }
    _.reflow = function () {
        pray('controller is defined', this.controller)
        this.controller.handle('reflow')
        this.controller.handle('edited')
        this.controller.handle('edit')
    }
}