/**
 * Registers every command. Import order is registration order: when two
 * modules define the same name, the later one wins (e.g. `\approx` from
 * symbols.ts overrides the plain symbol from symbols-config.json).
 */
import './text'
import './latexCommandInput'
import './math/advancedSymbols'
import './math/style'
import './math/supsub'
import './math/largeOperators'
import './math/fraction'
import './math/roots'
import './math/brackets'
import './math/innerField'
import './math/embed'
import './math/linebreak'
import './math/symbols'

export { latexCommands, charCommands, embeds } from './registry'
