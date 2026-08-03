import type { Direction } from './types'
import type { RootBlockMixinInput } from './shared_types'

export function RootBlockMixin(_: RootBlockMixinInput) {
    _.moveOutOf = function (dir: Direction) {
        this.controller.handle('moveOutOf', dir)
    }
    _.deleteOutOf = function (dir: Direction) {
        this.controller.handle('deleteOutOf', dir)
    }
    _.selectOutOf = function (dir: Direction) {
        this.controller.handle('selectOutOf', dir)
    }
    _.upOutOf = function () {
        this.controller.handle('upOutOf')
        return undefined
    }
    _.downOutOf = function () {
        this.controller.handle('downOutOf')
        return undefined
    }
    _.reflow = function () {
        this.controller.handle('reflow')
        this.controller.handle('edited')
        this.controller.handle('edit')
    }
}