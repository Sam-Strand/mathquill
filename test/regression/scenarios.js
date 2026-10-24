// Behaviour-capture scenarios for the regression suite (test/index.html).
// Uses ONLY the public MathQuill API, so results stay comparable across
// internal refactorings. Each scenario records LaTeX / text / HTML output.
export async function runAll(MQ, corpus, onProgress) {
    const results = {}
    const mock = document.getElementById('mock')
    const tick = () => new Promise((r) => setTimeout(r, 0))

    let count = 0
    function fresh(tag = 'span', text = '') {
        window.__clearAllIntervals && window.__clearAllIntervals()
        if (++count % 500 === 0 && onProgress) onProgress(count, lastId)
        mock.innerHTML = ''
        const el = document.createElement(tag)
        el.textContent = text
        mock.appendChild(el)
        return el
    }
    function safe(fn) {
        try {
            const v = fn()
            return v
        } catch (e) {
            return 'THROW:' + (e && e.message ? e.message : String(e)).slice(0, 120)
        }
    }
    function snap(mq, withHtml) {
        const o = { latex: safe(() => mq.latex()), text: safe(() => mq.text()) }
        if (withHtml) o.html = safe(() => mq.html())
        return o
    }
    let lastId = ''
    function record(id, fn) {
        lastId = id
        try {
            results[id] = fn()
        } catch (e) {
            results[id] = 'THROW:' + (e && e.message ? e.message : String(e)).slice(0, 120)
        }
    }
    const ops = (mq, list) =>
        list.map(([m, ...a]) => {
            const r = safe(() => {
                mq[m](...a)
                return null
            })
            return r === null ? safe(() => mq.latex()) : r
        })

    // 1. latex round-trip in MathField and StaticMath
    for (const l of corpus.latex) {
        record('mf-latex:' + l, () => {
            const mq = MQ.MathField(fresh())
            const r = safe(() => (mq.latex(l), null))
            return { err: r, ...snap(mq, true) }
        })
        record('static:' + l, () => {
            const mq = MQ.StaticMath(fresh('span', l))
            return snap(mq, true)
        })
    }
    for (const v of [undefined, null, 0, Infinity, NaN, true, false, {}])
        record('mf-latex-nonstring:' + String(v), () => {
            const mq = MQ.MathField(fresh())
            safe(() => mq.latex(v))
            return snap(mq)
        })

    // 2. typedText with option sets
    const optionSets = {
        none: {},
        autoCmds: { autoCommands: 'pi theta sqrt sum nthroot int prod' },
        autoOps: { autoOperatorNames: 'sin cos log ln lim arcsin hcf' },
        autoParens: { autoOperatorNames: 'sin cos', autoParenthesizedFunctions: 'sin cos' },
        autoSub: { autoSubscriptNumerals: true },
        breakOut: { charsThatBreakOutOfSupSub: '+-=<>' },
        sumN: { sumStartsWithNEquals: true },
        slashDiv: { typingSlashWritesDivisionSymbol: true, typingAsteriskWritesTimesSymbol: true, typingPercentWritesPercentOf: true },
        newFrac: { typingSlashCreatesNewFraction: true },
        restrict: { restrictMismatchedBrackets: true },
        supReq: { supSubsRequireOperand: true },
        grouping: { enableDigitGrouping: true },
        maxDepth: { maxDepth: 2 },
        noSubst: { disableAutoSubstitutionInSubscripts: true, autoCommands: 'pi', autoOperatorNames: 'sin' },
    }
    for (const [name, cfg] of Object.entries(optionSets)) {
        for (const t of corpus.typed) {
            record(`typed[${name}]:` + t, () => {
                const mq = MQ.MathField(fresh(), cfg)
                const err = safe(() => (mq.typedText(t), null))
                return { err, ...snap(mq, name === 'grouping' || name === 'none') }
            })
        }
    }

    // 3. keystroke sequences on starting latex, then type a marker
    const starts = [
        '', 'abc', '\\frac{1}{2}', 'x^{2}_{3}', 'x_{3}^{2}', '\\left(a+b\\right)', '\\sqrt[3]{x}', '\\sqrt{x+1}',
        '\\sum_{n=1}^{10}n', '\\text{hello}', '\\binom{n}{k}', '\\int_{0}^{1}x', '1+\\frac{a}{b+\\frac{c}{d}}',
        'a\\left[b\\right]c', '\\left|x\\right|', 'x^{2^{3}}', '\\sin x', '12345', 'a<b', 'a\\le b', 'a\\to b', 'a\\approx b',
        '\\mathbf{xy}', '\\textcolor{red}{q}', '\\vec{v}', '\\overline{ab}', '\\dot{3}',
    ]
    const seqs = [
        'Left', 'Right', 'Left Left', 'Left Left Left', 'Home', 'End', 'Ctrl-Home', 'Ctrl-End', 'Up', 'Down', 'Up Up', 'Down Down',
        'Left Up', 'Left Down', 'Home Right', 'Home Right Right', 'Tab', 'Shift-Tab', 'Esc', 'Shift-Esc', 'Spacebar', 'Shift-Spacebar',
        'Backspace', 'Backspace Backspace', 'Backspace Backspace Backspace', 'Left Backspace', 'Left Left Backspace', 'Home Del', 'Home Del Del',
        'Del', 'Left Del', 'Ctrl-Backspace', 'Ctrl-Del', 'Home Ctrl-Del', 'Left Ctrl-Backspace',
        'Shift-Left', 'Shift-Left Shift-Left', 'Shift-Left Shift-Left Shift-Left', 'Shift-Home', 'Shift-End', 'Home Shift-End',
        'Ctrl-Shift-Home', 'Home Ctrl-Shift-End', 'Shift-Up', 'Shift-Down', 'Left Shift-Right', 'Ctrl-A', 'Meta-A',
        'Left Left Shift-Left Shift-Left Shift-Left', 'Left Shift-Right Shift-Right Backspace', 'Ctrl-A Backspace', 'Ctrl-A Del',
        'Up Backspace', 'Down Backspace', 'Up Right', 'Down Right Right Down', 'Tab Backspace', 'Tab Tab Backspace',
        'Shift-Tab Shift-Tab Del', 'Left Left Left Left Left Backspace', 'Right Right Right',
    ]
    for (const cfgName of ['none', 'leftRightUp', 'spaceTab', 'autoSub']) {
        const cfg = { none: {}, leftRightUp: { leftRightIntoCmdGoes: 'up' }, spaceTab: { spaceBehavesLikeTab: true }, autoSub: { autoSubscriptNumerals: true } }[cfgName]
        for (const s of starts) {
            for (const k of seqs) {
                record(`keys[${cfgName}]:${s} | ${k}`, () => {
                    const mq = MQ.MathField(fresh(), cfg)
                    mq.latex(s)
                    const e1 = safe(() => (mq.keystroke(k), null))
                    const after = safe(() => mq.latex())
                    const e2 = safe(() => (mq.typedText('Z'), null))
                    return { e1, after, e2, final: safe(() => mq.latex()) }
                })
            }
        }
    }

    // 4. cmd / write, with and without selection
    const cmds = ['\\sqrt', '\\frac', '\\sum', '\\prod', '\\int', '^', '_', '\\nthroot', '\\cbrt', '\\binom', '\\choose', '\\text', '\\vec',
        '\\overline', '\\left', '\\langle', '\\lVert', '\\pi', '\\alpha', '\\sin', '\\mathbb', '\\operatorname', 'x', '+', '\\le', '\\cong',
        '\\notin', '\\equiv', '\\oplus', '\\otimes', '\\ne', '\\times', '\\div', '\\infty', '\\cdot', '\\textcolor', '\\mathrm', '\\mathit',
        '\\dot', '\\hat', '\\tilde', '\\over', '\\nonexistent', '\\']
    for (const c of cmds) {
        for (const start of ['', 'ab', 'x+1']) {
            record(`cmd:${start}|${c}`, () => {
                const mq = MQ.MathField(fresh())
                mq.latex(start)
                const e = safe(() => (mq.cmd(c), null))
                const after = safe(() => mq.latex())
                safe(() => mq.typedText('q'))
                return { e, after, final: safe(() => mq.latex()), html: safe(() => mq.html()) }
            })
            record(`cmd-sel:${start}|${c}`, () => {
                const mq = MQ.MathField(fresh())
                mq.latex(start)
                mq.select()
                const e = safe(() => (mq.cmd(c), null))
                const after = safe(() => mq.latex())
                safe(() => mq.typedText('q'))
                return { e, after, final: safe(() => mq.latex()) }
            })
        }
    }
    for (const w of ['x^2', '\\frac{1}{2}', '+1', '\\sqrt{x}', '\\left(\\right)', 'a_n', '\\text{t}', '}', '\\frac{', '\\cong', '\\mathbb{R}']) {
        record('write:' + w, () => {
            const mq = MQ.MathField(fresh())
            mq.latex('a+b')
            mq.keystroke('Left')
            const e = safe(() => (mq.write(w), null))
            return { e, ...snap(mq, true) }
        })
    }

    // 5. Typing-then-selection replacement with typedText of operators
    for (const t of ['(', ')', '[', '|', '/', '^', '_', '\\', '$', '{', '-', '*']) {
        record('sel-typed:' + t, () => {
            const mq = MQ.MathField(fresh())
            mq.latex('a+b')
            mq.select()
            const e = safe(() => (mq.typedText(t), null))
            safe(() => mq.typedText('q'))
            return { e, ...snap(mq) }
        })
    }

    // 6. handlers
    const handlerNames = ['edit', 'enter', 'moveOutOf', 'deleteOutOf', 'selectOutOf', 'upOutOf', 'downOutOf', 'reflow']
    for (const k of ['Left', 'Right', 'Backspace', 'Del', 'Shift-Left', 'Shift-Right', 'Up', 'Down', 'Enter', 'Home', 'Tab', 'Shift-Tab']) {
        for (const start of ['', 'a', '\\frac{1}{2}']) {
            record(`handlers:${start}|${k}`, () => {
                const log = []
                const handlers = {}
                let mqRef
                for (const h of handlerNames)
                    handlers[h] = (a, b) => {
                        const mq = b || a
                        log.push(h + (b ? ':' + a : '') + ':' + (mq === mqRef || (mq && mq.id === mqRef.id) ? 'same' : 'other') + ':' + (mq && typeof mq.latex === 'function'))
                    }
                mqRef = MQ.MathField(fresh(), { handlers })
                mqRef.latex(start)
                log.length = 0
                safe(() => mqRef.keystroke(k))
                safe(() => mqRef.typedText(k === 'Enter' ? '\n' : 'w'))
                return { log, latex: safe(() => mqRef.latex()) }
            })
        }
    }

    // 7. inner fields in static math
    record('innerFields', () => {
        const el = fresh('span', '\\frac{\\MathQuillMathField[n]{1}}{\\MathQuillMathField[d]{2}}+\\MathQuillMathField{3}')
        const st = MQ.StaticMath(el)
        const out = { initial: snap(st, true), count: st.innerFields.length }
        const n = st.innerFields.n
        out.nLatex = safe(() => n.latex())
        safe(() => n.typedText('+x'))
        safe(() => st.innerFields.d.latex('y^2'))
        out.afterEdit = snap(st)
        out.nAfter = safe(() => n.latex())
        safe(() => n.makeStatic())
        out.afterStatic = safe(() => n.latex())
        safe(() => n.makeEditable())
        safe(() => n.typedText('7'))
        out.afterEditable = safe(() => n.latex())
        safe(() => st.latex('\\MathQuillMathField[q]{5}'))
        out.relatex = snap(st)
        out.innerQ = safe(() => st.innerFields.q && st.innerFields.q.latex())
        out.innerFieldsLength = st.innerFields.length
        return out
    })

    // 8. TextField
    record('textField', () => {
        if (!MQ.TextField) return 'no TextField'
        const tf = MQ.TextField(fresh())
        const out = {}
        safe(() => tf.latex('abc $x^2$ def'))
        out.a = snap(tf, true)
        safe(() => tf.typedText('$y$'))
        out.b = snap(tf)
        safe(() => tf.keystroke('Left Left Backspace'))
        out.c = snap(tf)
        return out
    })

    // 9. embeds
    record('embed', () => {
        MQ.registerEmbed('thing', (data) => ({ htmlString: '<span class="thing">T' + (data || '') + '</span>', text: () => 'T', latex: () => '\\embed{thing}[' + (data || '') + ']' }))
        const mq = MQ.MathField(fresh())
        safe(() => mq.latex('1+\\embed{thing}[abc]+2'))
        const out = { a: snap(mq, true) }
        safe(() => mq.keystroke('Left Left Backspace'))
        out.b = snap(mq)
        out.badName = safe(() => (MQ.registerEmbed('1bad', () => ({})), 'ok'))
        return out
    })

    // 10. API surface
    record('api', () => {
        const out = {}
        const el = fresh()
        const mq = MQ.MathField(el)
        out.L = MQ.L
        out.R = MQ.R
        out.sameInstanceKind = safe(() => MQ(el) instanceof MQ.MathField)
        out.sameId = safe(() => MQ(el).id === mq.id)
        out.mathFieldTwice = safe(() => MQ.MathField(el).id === mq.id)
        out.isMQ = safe(() => mq instanceof MQ)
        out.isEditable = safe(() => mq instanceof MQ.EditableField)
        out.staticOnEditable = safe(() => String(MQ.StaticMath(el) && MQ.StaticMath(el).id === mq.id))
        out.nullEl = safe(() => MQ.MathField(null))
        out.mqNonMq = safe(() => MQ(document.body))
        out.el = safe(() => mq.el() === el)
        mq.latex('x^2')
        out.reflow = safe(() => mq.reflow() === mq)
        out.dataObj = safe(() => typeof mq.data)
        out.moveToLeftEnd = safe(() => (mq.moveToLeftEnd().typedText('L'), mq.latex()))
        out.moveToRightEnd = safe(() => (mq.moveToRightEnd().typedText('R'), mq.latex()))
        out.select = safe(() => (mq.select(), mq.typedText('S'), mq.latex()))
        out.clearSelection = safe(() => (mq.select().clearSelection().typedText('C'), mq.latex()))
        out.empty = safe(() => (mq.empty(), mq.latex()))
        mq.latex('a+b')
        out.revert = safe(() => {
            const r = mq.revert()
            return [r === el, el.innerHTML, el.className]
        })
        // static
        const sel = fresh('span', 'x^2')
        const st = MQ.StaticMath(sel)
        out.staticLatex = st.latex()
        out.staticSet = safe(() => (st.latex('\\frac{a}{b}'), st.latex()))
        out.staticIsEditable = safe(() => st instanceof MQ.EditableField)
        out.staticHasWrite = typeof st.write
        out.classes = sel.className
        // config
        out.config = safe(() => {
            const mq2 = MQ.MathField(fresh())
            mq2.config({ autoCommands: 'pi' }).typedText('pi')
            return mq2.latex()
        })
        out.badConfig = safe(() => (MQ.MathField(fresh(), { leftRightIntoCmdGoes: 'sideways' }), 'no throw'))
        out.badAutoCmd = safe(() => (MQ.MathField(fresh(), { autoCommands: 'a' }), 'no throw'))
        out.badAutoCmd2 = safe(() => (MQ.MathField(fresh(), { autoCommands: 'sin' }), 'no throw'))
        out.globalConfig = safe(() => {
            MQ.config({ autoCommands: 'theta' })
            const m = MQ.MathField(fresh())
            m.typedText('theta')
            const res = m.latex()
            MQ.config({ autoCommands: 'xyzzy' })
            return res
        })
        out.ignoreNextMousedown = safe(() => typeof mq.ignoreNextMousedown(() => true))
        out.dropEmbeddedType = typeof mq.dropEmbedded
        out.clickAtType = typeof mq.clickAt
        return out
    })

    // 11. textarea-driven events (saneKeyboardEvents path)
    async function viaTextarea(id, cfg, fn) {
        const el = fresh()
        const mq = MQ.MathField(el, cfg)
        const ta = el.querySelector('textarea')
        try {
            await fn(mq, ta, el)
            await tick()
            await tick()
            results[id] = { latex: safe(() => mq.latex()), ta: ta && ta.value, focused: el.classList.contains('mq-focused') }
        } catch (e) {
            results[id] = 'THROW:' + e.message
        }
    }
    const key = (ta, type, k, extra = {}) => ta.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true, ...extra }))
    await viaTextarea('ta:type-x', {}, async (mq, ta) => {
        ta.focus()
        key(ta, 'keydown', 'x')
        key(ta, 'keypress', 'x')
        ta.value = 'x'
        ta.dispatchEvent(new Event('input', { bubbles: true }))
        key(ta, 'keyup', 'x')
        await tick()
    })
    await viaTextarea('ta:arrow-backspace', {}, async (mq, ta) => {
        mq.latex('abc')
        ta.focus()
        key(ta, 'keydown', 'ArrowLeft')
        key(ta, 'keyup', 'ArrowLeft')
        key(ta, 'keydown', 'Backspace')
        key(ta, 'keyup', 'Backspace')
    })
    await viaTextarea('ta:paste', {}, async (mq, ta) => {
        ta.focus()
        ta.dispatchEvent(new Event('paste', { bubbles: true }))
        ta.value = '\\frac{1}{2}'
        await tick()
        ta.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await viaTextarea('ta:paste-stateless', { statelessClipboard: true }, async (mq, ta) => {
        ta.focus()
        ta.dispatchEvent(new Event('paste', { bubbles: true }))
        ta.value = 'hello'
        await tick()
        ta.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await viaTextarea('ta:select-copy', {}, async (mq, ta) => {
        mq.latex('\\frac{a}{b}+\\sin x')
        ta.focus()
        mq.select()
        await tick()
        await tick()
    })
    await viaTextarea('ta:override', { overrideKeystroke: (k) => (window.__ok = (window.__ok || '') + k + ','), overrideTypedText: (t) => (window.__ot = (window.__ot || '') + t) }, async (mq, ta) => {
        ta.focus()
        key(ta, 'keydown', 'ArrowLeft', { shiftKey: true, ctrlKey: true })
        key(ta, 'keydown', 'q')
        key(ta, 'keypress', 'q')
        ta.value = 'q'
        await tick()
        results['ta:override-log'] = [window.__ok, window.__ot]
    })
    await viaTextarea('ta:disableCopyPaste', { disableCopyPaste: true }, async (mq, ta) => {
        ta.focus()
        const ev = new Event('paste', { bubbles: true, cancelable: true })
        ta.dispatchEvent(ev)
        results['ta:disableCopyPaste-prevented'] = ev.defaultPrevented
    })
    await viaTextarea('ta:focus-blur', {}, async (mq, ta, el) => {
        mq.latex('a')
        mq.focus()
        results['ta:focus-blur-focused'] = [el.classList.contains('mq-focused'), !!el.querySelector('.mq-cursor')]
        mq.blur()
        await tick()
        await tick()
        results['ta:focus-blur-after'] = [el.classList.contains('mq-focused'), !!el.querySelector('.mq-cursor')]
    })
    await viaTextarea('ta:resetCursorOnBlur', { resetCursorOnBlur: true }, async (mq, ta) => {
        mq.latex('abc')
        mq.focus()
        mq.keystroke('Left Left')
        mq.blur()
        await tick()
        await tick()
        mq.typedText('z')
    })

    // 12. Mouse interaction (geometry, needs CSS)
    async function mouse(id, latex, fn) {
        const el = fresh()
        el.style.fontSize = '30px'
        const mq = MQ.MathField(el)
        mq.latex(latex)
        try {
            await fn(mq, el)
            await tick()
            safe(() => mq.typedText('Z'))
            results[id] = safe(() => mq.latex())
        } catch (e) {
            results[id] = 'THROW:' + e.message
        }
    }
    const center = (node) => {
        const r = node.getBoundingClientRect()
        return [r.left + r.width / 2, r.top + r.height / 2]
    }
    const fire = (target, type, x, y) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }))
    for (const [latex, sel] of [['abcdef', 'var'], ['\\frac{12}{34}', '.mq-denominator span'], ['x^{234}', '.mq-sup span'], ['\\sqrt{abc}', '.mq-sqrt-stem var'], ['\\text{hello world}', '.mq-text-mode']]) {
        await mouse('click:' + latex, latex, async (mq, el) => {
            const t = el.querySelectorAll(sel)
            const node = t[Math.min(1, t.length - 1)]
            const [x, y] = center(node)
            fire(node, 'mousedown', x - 2, y)
            fire(document, 'mouseup', x - 2, y)
        })
        await mouse('drag:' + latex, latex, async (mq, el) => {
            const root = el.querySelector('.mq-root-block')
            const r = root.getBoundingClientRect()
            const t = el.querySelectorAll(sel)
            const node = t[Math.min(1, t.length - 1)]
            const [x, y] = center(node)
            fire(node, 'mousedown', x - 2, y)
            fire(root, 'mousemove', r.right - 2, y)
            fire(document, 'mousemove', r.right - 2, y)
            fire(document, 'mouseup', r.right - 2, y)
        })
        await mouse('clickAt:' + latex, latex, async (mq, el) => {
            const t = el.querySelectorAll(sel)
            const node = t[t.length - 1]
            const [x, y] = center(node)
            mq.clickAt(x + 1, y, node)
        })
    }

    // 13. digit grouping DOM + efficient update path
    record('grouping-update', () => {
        const mq = MQ.MathField(fresh(), { enableDigitGrouping: true })
        const out = []
        for (const l of ['1', '12', '1234', '-1234', '1234567', '123', '-5', '5', '1.2345', 'x+12345', 'x+-12', 'x+123456']) {
            mq.latex(l)
            out.push([mq.latex(), mq.html()])
        }
        return out
    })
    // 14. static math interactions
    record('static-select', () => {
        const st = MQ.StaticMath(fresh('span', '\\frac{1}{2}'))
        return { kd: safe(() => (st.keystroke && st.keystroke('Left'), 'ok')), html: st.html(), text: st.text() }
    })
    // 16. misc interactions
    await (async () => {
        const out = {}
        // static math drag-select then copy goes to textarea
        {
            const el = fresh('span', '\\frac{12}{34}+x^{2}')
            el.style.fontSize = '30px'
            const st = MQ.StaticMath(el)
            const root = el.querySelector('.mq-root-block')
            const r = root.getBoundingClientRect()
            fire(root.firstElementChild, 'mousedown', r.left + 2, r.top + r.height / 2)
            fire(root, 'mousemove', r.right - 2, r.top + r.height / 2)
            fire(document, 'mousemove', r.right - 2, r.top + r.height / 2)
            fire(document, 'mouseup', r.right - 2, r.top + r.height / 2)
            await tick(); await tick()
            const ta = el.querySelector('textarea')
            out.staticSel = [!!el.querySelector('.mq-selection'), ta && ta.value]
        }
        // inner field: click and type through the textarea
        {
            const el = fresh('span', '1+\\MathQuillMathField[a]{2}')
            el.style.fontSize = '30px'
            const st = MQ.StaticMath(el)
            const inner = el.querySelector('.mq-editable-field .mq-root-block')
            const [x, y] = center(inner)
            fire(inner.firstElementChild || inner, 'mousedown', x + 5, y)
            fire(document, 'mouseup', x + 5, y)
            await tick()
            const ta = el.querySelector('.mq-editable-field textarea')
            ta.focus()
            key(ta, 'keydown', '7'); key(ta, 'keypress', '7'); ta.value = '7'; ta.dispatchEvent(new Event('input', { bubbles: true }))
            await tick(); await tick()
            out.inner = [st.latex(), st.innerFields.a.latex(), MQ(el.querySelector('.mq-editable-field')) === st.innerFields.a]
        }
        // TextField editing
        {
            const tf = MQ.TextField(fresh())
            tf.typedText('ab$x^2')
            tf.keystroke('Right')
            tf.typedText('c')
            out.textField = [tf.latex(), tf.text()]
            tf.keystroke('Left Left Left Left Backspace')
            out.textField2 = tf.latex()
        }
        // focused digit grouping suppression
        {
            const el = fresh()
            const mq = MQ.MathField(el, { enableDigitGrouping: true })
            mq.focus()
            mq.typedText('123456')
            out.grouping = [el.querySelector('.mq-root-block').classList.contains('mq-suppress-grouping'), mq.html()]
        }
        // revert then recreate
        {
            const el = fresh('span', 'x+1')
            let mq = MQ.MathField(el)
            mq.typedText('2')
            const r = mq.revert()
            out.reverted = [r.innerHTML, MQ(el)]
            mq = MQ.MathField(el)
            out.recreated = mq.latex()
        }
        // edit handler count for latex() and typing
        {
            let n = 0
            const mq = MQ.MathField(fresh('span', 'a'), { handlers: { edit: () => n++ } })
            out.editsInit = n
            mq.latex('x^2+1'); out.editsLatex = n
            mq.typedText('3'); out.editsTyped = n
            mq.keystroke('Backspace'); out.editsBack = n
            mq.write('\\frac{1}{2}'); out.editsWrite = n
            mq.cmd('\\sqrt'); out.editsCmd = n
        }
        // supsub combos
        {
            const mq = MQ.MathField(fresh())
            mq.typedText('x^2'); mq.keystroke('Right'); mq.typedText('_3')
            out.supsub1 = mq.latex()
            mq.keystroke('Left Backspace Backspace')
            out.supsub2 = mq.latex()
            mq.latex('x_{1}^{2}'); mq.keystroke('Left Left Backspace Backspace'); out.supsub3 = mq.latex()
            mq.latex('x^{2}'); mq.keystroke('Left Left'); mq.typedText('_'); mq.typedText('5'); out.supsub4 = mq.latex()
        }
        // brackets
        {
            const mq = MQ.MathField(fresh())
            mq.typedText('(a+b'); out.br1 = mq.latex()
            mq.typedText(')'); out.br2 = mq.latex()
            mq.keystroke('Backspace'); out.br3 = mq.latex()
            mq.keystroke('Home'); mq.typedText('|x'); out.br4 = mq.latex()
            mq.typedText('|'); out.br5 = mq.latex()
            mq.latex('\\left(1+2\\right)'); mq.keystroke('Left Backspace'); out.br6 = mq.latex()
            mq.latex('\\left(1+2\\right)'); mq.keystroke('Left Left Del'); out.br7 = mq.latex()
        }
        results['misc'] = out
    })()

    // 15. every registered command name: parse, cmd(), typed through backslash input
    for (const n of corpus.cmdnames) {
        record('name-latex:' + n, () => {
            const mq = MQ.MathField(fresh())
            const e = safe(() => (mq.latex('\\' + n + ' {a}{b}'), null))
            return { e, ...snap(mq, true) }
        })
        record('name-cmd:' + n, () => {
            const mq = MQ.MathField(fresh())
            const e = safe(() => (mq.cmd('\\' + n), null))
            safe(() => mq.typedText('q'))
            return { e, ...snap(mq, true) }
        })
        if (/^[a-z]+$/i.test(n))
            record('name-typed:' + n, () => {
                const mq = MQ.MathField(fresh())
                const e = safe(() => (mq.typedText('\\' + n), mq.keystroke('Tab'), mq.typedText('q'), null))
                return { e, ...snap(mq) }
            })
    }
    return results
}
