/**
 * Command registry: maps LaTeX control sequences (without backslash) and
 * typed characters to factories of tree nodes.
 *
 * Command modules register themselves when imported; `commands/index.ts`
 * imports them in a fixed order (later registrations override earlier ones).
 */
import type { MQNode } from '../tree/node'
import { isNodeClass } from '../tree/node'
import type { EmbedOptions, EmbedOptionsData } from '../public/types'

/** Creates a node for the control sequence / character it was registered under. */
export type CommandFactory = (name: string) => MQNode

/** A node class or a factory function. */
export type CommandDefinition = (new (name: string) => MQNode) | CommandFactory

function toFactory(def: CommandDefinition): CommandFactory {
    return isNodeClass(def) ? (name) => new def(name) : (def as CommandFactory)
}

class CommandTable {
    private readonly factories = new Map<string, CommandFactory>()

    /** Register `def` under one or more names. */
    define(names: string | readonly string[], def: CommandDefinition): void {
        const factory = toFactory(def)
        for (const name of typeof names === 'string' ? [names] : names) this.factories.set(name, factory)
    }

    has(name: string): boolean {
        return this.factories.has(name)
    }

    /** Instantiate the command registered under `name`, if any. */
    create(name: string): MQNode | undefined {
        return this.factories.get(name)?.(name)
    }
}

/** `\name` commands, as written in LaTeX. */
export const latexCommands = new CommandTable()
/** Characters with special behaviour when typed (brackets, `/`, `\`, ...). */
export const charCommands = new CommandTable()

/** Embeds registered through `MathQuill.registerEmbed`. */
export const embeds = new Map<string, (data: EmbedOptionsData) => EmbedOptions>()

/**
 * Factories for the two node kinds every math block needs while typing and
 * parsing. Registered by the symbols module (avoids an import cycle with the
 * math core).
 */
export const basicNodes: {
    letter: (ch: string) => MQNode
    digit: (ch: string) => MQNode
} = {
    letter() {
        throw new Error('letter factory not registered')
    },
    digit() {
        throw new Error('digit factory not registered')
    },
}
