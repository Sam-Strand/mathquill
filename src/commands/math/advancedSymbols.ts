/************************************
 * Symbols for Advanced Mathematics
 ***********************************/
import { isMQNodeClass } from '../../tree'
import { LatexCmds } from '../../registry'
import { h } from '../../dom'
import { MathCommand, BinaryOperator, bindVanillaSymbol, bindBinaryOperator } from '../../commands/math/core'
import { Cursor } from '../../cursor'
import { MQNodeBuilderNoParam } from '../../shared_types'
import { Parser } from '../../services/parser.util'

LatexCmds.notin =
    LatexCmds.cong =
    LatexCmds.equiv =
    LatexCmds.oplus =
    LatexCmds.otimes =
    (latex: string) =>
        new BinaryOperator('\\' + latex + ' ', h.entityText('&' + latex + ';'))

LatexCmds['∗'] =
    LatexCmds.ast =
    LatexCmds.star =
    LatexCmds.loast =
    LatexCmds.lowast =
    bindBinaryOperator('\\ast ', '&lowast;', 'low asterisk')
LatexCmds.therefor = LatexCmds.therefore = bindBinaryOperator(
    '\\therefore ',
    '&there4;',
    'therefore'
)

LatexCmds.cuz = LatexCmds.because = bindBinaryOperator(
    // l33t
    '\\because ',
    '&#8757;',
    'because'
)

LatexCmds.prop = LatexCmds.propto = bindBinaryOperator(
    '\\propto ',
    '&prop;',
    'proportional to'
)

LatexCmds['≈'] =
    LatexCmds.asymp =
    LatexCmds.approx =
    bindBinaryOperator('\\approx ', '&asymp;', 'approximately equal to')

LatexCmds.isin = LatexCmds['in'] = bindBinaryOperator(
    '\\in ',
    '&isin;',
    'is in'
)

LatexCmds.ni = LatexCmds.contains = bindBinaryOperator(
    '\\ni ',
    '&ni;',
    'is not in'
)

LatexCmds.notni =
    LatexCmds.niton =
    LatexCmds.notcontains =
    LatexCmds.doesnotcontain =
    bindBinaryOperator('\\not\\ni ', '&#8716;', 'does not contain')

LatexCmds.sub = LatexCmds.subset = bindBinaryOperator(
    '\\subset ',
    '&sub;',
    'subset'
)

LatexCmds.sup =
    LatexCmds.supset =
    LatexCmds.superset =
    bindBinaryOperator('\\supset ', '&sup;', 'superset')

LatexCmds.nsub =
    LatexCmds.notsub =
    LatexCmds.nsubset =
    LatexCmds.notsubset =
    bindBinaryOperator('\\not\\subset ', '&#8836;', 'not a subset')

LatexCmds.nsup =
    LatexCmds.notsup =
    LatexCmds.nsupset =
    LatexCmds.notsupset =
    LatexCmds.nsuperset =
    LatexCmds.notsuperset =
    bindBinaryOperator('\\not\\supset ', '&#8837;', 'not a superset')

LatexCmds.sube =
    LatexCmds.subeq =
    LatexCmds.subsete =
    LatexCmds.subseteq =
    bindBinaryOperator('\\subseteq ', '&sube;', 'subset or equal to')

LatexCmds.supe =
    LatexCmds.supeq =
    LatexCmds.supsete =
    LatexCmds.supseteq =
    LatexCmds.supersete =
    LatexCmds.superseteq =
    bindBinaryOperator('\\supseteq ', '&supe;', 'superset or equal to')

LatexCmds.nsube =
    LatexCmds.nsubeq =
    LatexCmds.notsube =
    LatexCmds.notsubeq =
    LatexCmds.nsubsete =
    LatexCmds.nsubseteq =
    LatexCmds.notsubsete =
    LatexCmds.notsubseteq =
    bindBinaryOperator('\\not\\subseteq ', '&#8840;', 'not subset or equal to')

LatexCmds.nsupe =
    LatexCmds.nsupeq =
    LatexCmds.notsupe =
    LatexCmds.notsupeq =
    LatexCmds.nsupsete =
    LatexCmds.nsupseteq =
    LatexCmds.notsupsete =
    LatexCmds.notsupseteq =
    LatexCmds.nsupersete =
    LatexCmds.nsuperseteq =
    LatexCmds.notsupersete =
    LatexCmds.notsuperseteq =
    bindBinaryOperator(
        '\\not\\supseteq ',
        '&#8841;',
        'not superset or equal to'
    )

//the canonical sets of numbers
LatexCmds.mathbb = class extends MathCommand {
    createLeftOf(_cursor: Cursor) { }
    numBlocks() {
        return 1 as const
    }
    parser() {
        var string = Parser.string
        var regex = Parser.regex
        var optWhitespace = Parser.optWhitespace
        return optWhitespace
            .then(string('{'))
            .then(optWhitespace)
            .then(regex(/^[NPZQRCH]/))
            .skip(optWhitespace)
            .skip(string('}'))
            .map(function (c) {
                // instantiate the class for the matching char
                var cmd = LatexCmds[c]
                if (isMQNodeClass(cmd)) {
                    return new cmd()
                } else {
                    return (cmd as MQNodeBuilderNoParam)()
                }
            })
    }
}

LatexCmds.N =
    LatexCmds.naturals =
    LatexCmds.Naturals =
    bindVanillaSymbol('\\mathbb{N}', '&#8469;')

LatexCmds.P =
    LatexCmds.primes =
    LatexCmds.Primes =
    LatexCmds.projective =
    LatexCmds.Projective =
    LatexCmds.probability =
    LatexCmds.Probability =
    bindVanillaSymbol('\\mathbb{P}', '&#8473;')

LatexCmds.Z =
    LatexCmds.integers =
    LatexCmds.Integers =
    bindVanillaSymbol('\\mathbb{Z}', '&#8484;')

LatexCmds.Q =
    LatexCmds.rationals =
    LatexCmds.Rationals =
    bindVanillaSymbol('\\mathbb{Q}', '&#8474;')

LatexCmds.R =
    LatexCmds.reals =
    LatexCmds.Reals =
    bindVanillaSymbol('\\mathbb{R}', '&#8477;')

LatexCmds.C =
    LatexCmds.complex =
    LatexCmds.Complex =
    LatexCmds.complexes =
    LatexCmds.Complexes =
    LatexCmds.complexplane =
    LatexCmds.Complexplane =
    LatexCmds.ComplexPlane =
    bindVanillaSymbol('\\mathbb{C}', '&#8450;')

LatexCmds.H =
    LatexCmds.Hamiltonian =
    LatexCmds.quaternions =
    LatexCmds.Quaternions =
    bindVanillaSymbol('\\mathbb{H}', '&#8461;')

//spacing
LatexCmds.quad = LatexCmds.emsp = bindVanillaSymbol(
    '\\quad ',
    '    '
)
LatexCmds.qquad = bindVanillaSymbol('\\qquad ', '        ')
/* spacing special characters, gonna have to implement this in LatexCommandInput::onText somehow
case ',':
  return VanillaSymbol('\\, ',' ', 'comma')
case ':':
  return VanillaSymbol('\\: ','  ', 'colon')
case ';':
  return VanillaSymbol('\\; ','   ', 'semicolon')
case '!':
  return MQSymbol('\\! ','<span style="margin-right:-.2em"></span>', 'exclamation point')
*/

//binary operators
LatexCmds.diamond = bindVanillaSymbol('\\diamond ', '&#9671;')
LatexCmds.bigtriangleup = bindVanillaSymbol(
    '\\bigtriangleup ',
    '&#9651;'
)
LatexCmds.ominus = bindVanillaSymbol('\\ominus ', '&#8854;')
LatexCmds.uplus = bindVanillaSymbol('\\uplus ', '&#8846;')
LatexCmds.bigtriangledown = bindVanillaSymbol(
    '\\bigtriangledown ',
    '&#9661;'
)
LatexCmds.sqcap = bindVanillaSymbol(
    '\\sqcap ',
    '&#8851;'
)
LatexCmds.triangleleft = bindVanillaSymbol(
    '\\triangleleft ',
    '&#8882;'
)
LatexCmds.sqcup = bindVanillaSymbol('\\sqcup ', '&#8852;')
LatexCmds.triangleright = bindVanillaSymbol(
    '\\triangleright ',
    '&#8883;'
)
//circledot is not a not real LaTex command see https://github.com/mathquill/mathquill/pull/552 for more details
LatexCmds.odot = LatexCmds.circledot = bindVanillaSymbol(
    '\\odot ',
    '&#8857;'
)
LatexCmds.bigcirc = bindVanillaSymbol('\\bigcirc ', '&#9711;')
LatexCmds.dagger = bindVanillaSymbol('\\dagger ', '&#0134;')
LatexCmds.ddagger = bindVanillaSymbol('\\ddagger ', '&#135;')
LatexCmds.wr = bindVanillaSymbol('\\wr ', '&#8768;')
LatexCmds.amalg = bindVanillaSymbol('\\amalg ', '&#8720;')

//relationship symbols
LatexCmds.models = bindVanillaSymbol('\\models ', '&#8872;')
LatexCmds.prec = bindVanillaSymbol('\\prec ', '&#8826;')
LatexCmds.succ = bindVanillaSymbol('\\succ ', '&#8827;')
LatexCmds.preceq = bindVanillaSymbol(
    '\\preceq ',
    '&#8828;'
)
LatexCmds.succeq = bindVanillaSymbol(
    '\\succeq ',
    '&#8829;'
)
LatexCmds.simeq = bindVanillaSymbol(
    '\\simeq ',
    '&#8771;'
)
LatexCmds.mid = bindVanillaSymbol('\\mid ', '&#8739;')
LatexCmds.ll = bindVanillaSymbol('\\ll ', '&#8810;')
LatexCmds.gg = bindVanillaSymbol('\\gg ', '&#8811;')
LatexCmds.parallel = bindVanillaSymbol(
    '\\parallel ',
    '&#8741;'
)
LatexCmds.nparallel = bindVanillaSymbol(
    '\\nparallel ',
    '&#8742;'
)
LatexCmds.bowtie = bindVanillaSymbol('\\bowtie ', '&#8904;')
LatexCmds.sqsubset = bindVanillaSymbol(
    '\\sqsubset ',
    '&#8847;'
)
LatexCmds.sqsupset = bindVanillaSymbol(
    '\\sqsupset ',
    '&#8848;'
)
LatexCmds.smile = bindVanillaSymbol('\\smile ', '&#8995;')
LatexCmds.sqsubseteq = bindVanillaSymbol(
    '\\sqsubseteq ',
    '&#8849;'
)
LatexCmds.sqsupseteq = bindVanillaSymbol(
    '\\sqsupseteq ',
    '&#8850;'
)
LatexCmds.doteq = bindVanillaSymbol('\\doteq ', '&#8784;')
LatexCmds.frown = bindVanillaSymbol('\\frown ', '&#8994;')
LatexCmds.vdash = bindVanillaSymbol('\\vdash ', '&#8870;')
LatexCmds.dashv = bindVanillaSymbol('\\dashv ', '&#8867;')
LatexCmds.nless = bindVanillaSymbol('\\nless ', '&#8814;')
LatexCmds.ngtr = bindVanillaSymbol('\\ngtr ', '&#8815;')

//arrows
LatexCmds.longleftarrow = bindVanillaSymbol(
    '\\longleftarrow ',
    '&#8592;'
)
LatexCmds.longrightarrow = bindVanillaSymbol(
    '\\longrightarrow ',
    '&#8594;'
)
LatexCmds.Longleftarrow = bindVanillaSymbol(
    '\\Longleftarrow ',
    '&#8656;'
)
LatexCmds.Longrightarrow = bindVanillaSymbol(
    '\\Longrightarrow ',
    '&#8658;'
)
LatexCmds.longleftrightarrow = bindVanillaSymbol(
    '\\longleftrightarrow ',
    '&#8596;'
)
LatexCmds.updownarrow = bindVanillaSymbol(
    '\\updownarrow ',
    '&#8597;'
)
LatexCmds.Longleftrightarrow = bindVanillaSymbol(
    '\\Longleftrightarrow ',
    '&#8660;'
)
LatexCmds.Updownarrow = bindVanillaSymbol(
    '\\Updownarrow ',
    '&#8661;'
)
LatexCmds.mapsto = bindVanillaSymbol('\\mapsto ', '&#8614;')
LatexCmds.nearrow = bindVanillaSymbol(
    '\\nearrow ',
    '&#8599;'
)
LatexCmds.hookleftarrow = bindVanillaSymbol(
    '\\hookleftarrow ',
    '&#8617;'
)
LatexCmds.hookrightarrow = bindVanillaSymbol(
    '\\hookrightarrow ',
    '&#8618;'
)
LatexCmds.searrow = bindVanillaSymbol(
    '\\searrow ',
    '&#8600;'
)
LatexCmds.leftharpoonup = bindVanillaSymbol(
    '\\leftharpoonup ',
    '&#8636;'
)
LatexCmds.rightharpoonup = bindVanillaSymbol(
    '\\rightharpoonup ',
    '&#8640;'
)
LatexCmds.swarrow = bindVanillaSymbol(
    '\\swarrow ',
    '&#8601;'
)
LatexCmds.leftharpoondown = bindVanillaSymbol(
    '\\leftharpoondown ',
    '&#8637;'
)
LatexCmds.rightharpoondown = bindVanillaSymbol(
    '\\rightharpoondown ',
    '&#8641;'
)
LatexCmds.nwarrow = bindVanillaSymbol(
    '\\nwarrow ',
    '&#8598;'
)

//Misc
LatexCmds.ldots = bindVanillaSymbol('\\ldots ', '&#8230;')
LatexCmds.cdots = bindVanillaSymbol('\\cdots ', '&#8943;')
LatexCmds.vdots = bindVanillaSymbol('\\vdots ', '&#8942;')
LatexCmds.ddots = bindVanillaSymbol('\\ddots ', '&#8945;')
LatexCmds.surd = bindVanillaSymbol('\\surd ', '&#8730;')
LatexCmds.triangle = bindVanillaSymbol('\\triangle ', '&#9651;')
LatexCmds.ell = bindVanillaSymbol('\\ell ', '&#8467;')
LatexCmds.top = bindVanillaSymbol('\\top ', '&#8868;')
LatexCmds.flat = bindVanillaSymbol('\\flat ', '&#9837;')
LatexCmds.natural = bindVanillaSymbol('\\natural ', '&#9838;')
LatexCmds.sharp = bindVanillaSymbol('\\sharp ', '&#9839;')
LatexCmds.wp = bindVanillaSymbol('\\wp ', '&#8472;')
LatexCmds.bot = bindVanillaSymbol('\\bot ', '&#8869;')
LatexCmds.clubsuit = bindVanillaSymbol('\\clubsuit ')
LatexCmds.diamondsuit = bindVanillaSymbol(
    '\\diamondsuit ',
    '&#9826;'
)
LatexCmds.heartsuit = bindVanillaSymbol(
    '\\heartsuit ',
    '&#9825;'
)
LatexCmds.spadesuit = bindVanillaSymbol(
    '\\spadesuit ',
    '&#9824;'
)
//not real LaTex command see https://github.com/mathquill/mathquill/pull/552 for more details
LatexCmds.parallelogram = bindVanillaSymbol(
    '\\parallelogram ',
    '&#9649;'
)
LatexCmds.square = bindVanillaSymbol('\\square ', '&#11036;')

//variable-sized
LatexCmds.oint = bindVanillaSymbol('\\oint ', '&#8750;')
LatexCmds.bigcap = bindVanillaSymbol('\\bigcap ', '&#8745;')
LatexCmds.bigcup = bindVanillaSymbol('\\bigcup ', '&#8746;')
LatexCmds.bigsqcup = bindVanillaSymbol(
    '\\bigsqcup ',
    '&#8852;'
)
LatexCmds.bigvee = bindVanillaSymbol('\\bigvee ', '&#8744;')
LatexCmds.bigwedge = bindVanillaSymbol('\\bigwedge ', '&#8743;')
LatexCmds.bigodot = bindVanillaSymbol('\\bigodot ', '&#8857;')
LatexCmds.bigotimes = bindVanillaSymbol('\\bigotimes ', '&#8855;')
LatexCmds.bigoplus = bindVanillaSymbol('\\bigoplus ', '&#8853;')
LatexCmds.biguplus = bindVanillaSymbol('\\biguplus ', '&#8846;')

//delimiters
LatexCmds.lfloor = bindVanillaSymbol('\\lfloor ', '&#8970;')
LatexCmds.rfloor = bindVanillaSymbol('\\rfloor ', '&#8971;')
LatexCmds.lceil = bindVanillaSymbol('\\lceil ', '&#8968;')
LatexCmds.rceil = bindVanillaSymbol('\\rceil ', '&#8969;')
LatexCmds.opencurlybrace = LatexCmds.lbrace = bindVanillaSymbol(
    '\\lbrace ',
    '{'
)
LatexCmds.closecurlybrace = LatexCmds.rbrace = bindVanillaSymbol(
    '\\rbrace ',
    '}'
)
LatexCmds.lbrack = bindVanillaSymbol('[', 'left bracket')
LatexCmds.rbrack = bindVanillaSymbol(']', 'right bracket')

//various symbols
LatexCmds.slash = bindVanillaSymbol('/', 'slash')
LatexCmds.vert = bindVanillaSymbol('|', 'vertical bar')
LatexCmds.perp = LatexCmds.perpendicular = bindVanillaSymbol(
    '\\perp ',
    '&perp;'
)
LatexCmds.nabla = LatexCmds.del = bindVanillaSymbol('\\nabla ', '&nabla;')
LatexCmds.hbar = bindVanillaSymbol('\\hbar ', '&#8463;')

LatexCmds.AA =
    LatexCmds.Angstrom =
    LatexCmds.angstrom =
    bindVanillaSymbol('\\text\\AA ', '&#8491;')

LatexCmds.ring =
    LatexCmds.circ =
    LatexCmds.circle =
    bindVanillaSymbol('\\circ ', '&#8728;')

LatexCmds.bull = LatexCmds.bullet = bindVanillaSymbol(
    '\\bullet ',
    '&bull;'
)

LatexCmds.setminus = LatexCmds.smallsetminus = bindVanillaSymbol(
    '\\setminus ',
    '&#8726;'
)

LatexCmds.not = //bind(MQSymbol,'\\not ','<span class="not">/</span>', 'not')
    LatexCmds['¬'] =
    LatexCmds.neg =
    bindVanillaSymbol('\\neg ', '&not;')

LatexCmds['…'] =
    LatexCmds.dots =
    LatexCmds.ellip =
    LatexCmds.hellip =
    LatexCmds.ellipsis =
    LatexCmds.hellipsis =
    bindVanillaSymbol('\\dots ', '&hellip;')

LatexCmds.converges =
    LatexCmds.darr =
    LatexCmds.dnarr =
    LatexCmds.dnarrow =
    LatexCmds.downarrow =
    bindVanillaSymbol('\\downarrow ', '&darr;')

LatexCmds.dArr =
    LatexCmds.dnArr =
    LatexCmds.dnArrow =
    LatexCmds.Downarrow =
    bindVanillaSymbol('\\Downarrow ', '&dArr;')

LatexCmds.diverges =
    LatexCmds.uarr =
    LatexCmds.uparrow =
    bindVanillaSymbol('\\uparrow ', '&uarr;')

LatexCmds.uArr = LatexCmds.Uparrow = bindVanillaSymbol(
    '\\Uparrow ',
    '&uArr;'
)

LatexCmds.rarr = LatexCmds.rightarrow = bindVanillaSymbol(
    '\\rightarrow ',
    '&rarr;'
)

LatexCmds.implies = bindBinaryOperator('\\Rightarrow ', '&rArr;', 'implies')

LatexCmds.rArr = LatexCmds.Rightarrow = bindVanillaSymbol(
    '\\Rightarrow ',
    '&rArr;'
)

LatexCmds.gets = bindBinaryOperator('\\gets ', '&larr;', 'gets')

LatexCmds.larr = LatexCmds.leftarrow = bindVanillaSymbol(
    '\\leftarrow ',
    '&larr;'
)

LatexCmds.impliedby = bindBinaryOperator(
    '\\Leftarrow ',
    '&lArr;',
    'implied by'
)

LatexCmds.lArr = LatexCmds.Leftarrow = bindVanillaSymbol(
    '\\Leftarrow ',
    '&lArr;'
)

LatexCmds.harr =
    LatexCmds.lrarr =
    LatexCmds.leftrightarrow =
    bindVanillaSymbol('\\leftrightarrow ', '&harr;')

LatexCmds.iff = bindBinaryOperator(
    '\\Leftrightarrow ',
    '&hArr;',
    'if and only if'
)

LatexCmds.hArr =
    LatexCmds.lrArr =
    LatexCmds.Leftrightarrow =
    bindVanillaSymbol('\\Leftrightarrow ', '&hArr;')

LatexCmds.Re =
    LatexCmds.Real =
    LatexCmds.real =
    bindVanillaSymbol('\\Re ', '&real;')

LatexCmds.Im =
    LatexCmds.imag =
    LatexCmds.image =
    LatexCmds.imagin =
    LatexCmds.imaginary =
    LatexCmds.Imaginary =
    bindVanillaSymbol('\\Im ', '&image;')

LatexCmds.part = LatexCmds.partial = bindVanillaSymbol(
    '\\partial ',
    '&part;'
)

LatexCmds.pounds = bindVanillaSymbol('\\pounds ', '&pound;')

LatexCmds.alef =
    LatexCmds.alefsym =
    LatexCmds.aleph =
    LatexCmds.alephsym =
    bindVanillaSymbol('\\aleph ', '&alefsym;')

LatexCmds.xist = //LOL
    LatexCmds.xists =
    LatexCmds.exist =
    LatexCmds.exists =
    bindVanillaSymbol('\\exists ', '&exist;')

LatexCmds.nexists = LatexCmds.nexist = bindVanillaSymbol(
    '\\nexists ',
    '&#8708;'
)

LatexCmds.and =
    LatexCmds.land =
    LatexCmds.wedge =
    bindBinaryOperator('\\wedge ', '&and;', 'and')

LatexCmds.or =
    LatexCmds.lor =
    LatexCmds.vee =
    bindBinaryOperator('\\vee ', '&or;', 'or')

LatexCmds.o =
    LatexCmds.O =
    LatexCmds.empty =
    LatexCmds.emptyset =
    LatexCmds.oslash =
    LatexCmds.Oslash =
    LatexCmds.nothing =
    LatexCmds.varnothing =
    bindBinaryOperator('\\varnothing ', '&empty;', 'nothing')

LatexCmds.cup = LatexCmds.union = bindBinaryOperator(
    '\\cup ',
    '&cup;',
    'union'
)

LatexCmds.cap =
    LatexCmds.intersect =
    LatexCmds.intersection =
    bindBinaryOperator('\\cap ', '&cap;', 'intersection')

// FIXME: the correct LaTeX would be ^\circ but we can't parse that
LatexCmds.deg = LatexCmds.degree = bindVanillaSymbol(
    '\\degree ',
    '&deg;'
)

LatexCmds.ang = LatexCmds.angle = bindVanillaSymbol(
    '\\angle ',
    '&ang;'
)
LatexCmds.measuredangle = bindVanillaSymbol(
    '\\measuredangle ',
    '&#8737;'
)
