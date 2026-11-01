<template>
    <span ref="el"></span>
</template>

<script setup lang="ts">
/**
 * <MathQuillEditor v-model="latex" :config="{ ... }" />
 *
 * An editable math field bound to a LaTeX string, with its own
 * undo/redo history (Ctrl+Z / Ctrl+Y).
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MathQuill from '..'
import type { Config, CursorPosition, MathFieldApi } from '..'

const props = withDefaults(defineProps<{ modelValue?: string; config?: Config }>(), {
    modelValue: '',
    config: () => ({}),
})
const emit = defineEmits<{ 'update:modelValue': [latex: string] }>()

const MAX_HISTORY = 100

/** A history state: the content and where the cursor was in it. */
interface Entry {
    latex: string
    position?: CursorPosition
}

const el = ref<HTMLElement | null>(null)
let field: MathFieldApi | null = null
let restoring = false
const history: Entry[] = [{ latex: '' }]
let historyIndex = 0

function restore(index: number) {
    if (!field || index < 0 || index >= history.length) return
    restoring = true
    historyIndex = index
    const entry = history[index]
    field.latex(entry.latex)
    if (entry.position) field.setCursorPosition(entry.position)
    restoring = false
    emit('update:modelValue', entry.latex)
}

function record(latex: string, position: CursorPosition) {
    const current = history[historyIndex]
    if (current.latex === latex) {
        current.position = position
        return
    }
    history.splice(historyIndex + 1) // drop the redo branch
    history.push({ latex, position })
    if (history.length > MAX_HISTORY) history.shift()
    historyIndex = history.length - 1
}

/**
 * Before any input that may edit the field, remember the cursor in the
 * current state: undoing the next edit puts the cursor back there.
 */
function rememberCursor() {
    if (field) history[historyIndex].position = field.cursorPosition()
}

function onKeydown(e: KeyboardEvent) {
    if (!e.ctrlKey) return
    if (e.code === 'KeyZ') {
        e.preventDefault()
        restore(historyIndex - 1)
    } else if (e.code === 'KeyY') {
        e.preventDefault()
        restore(historyIndex + 1)
    }
}

const capture = { capture: true }

onMounted(() => {
    if (!el.value) return
    const userHandlers = props.config.handlers
    field = MathQuill.MathField(el.value, {
        spaceBehavesLikeTab: true,
        ...props.config,
        handlers: {
            ...userHandlers,
            edit: (mq) => {
                userHandlers?.edit?.(mq)
                if (restoring) return
                const latex = mq.latex()
                record(latex, mq.cursorPosition())
                emit('update:modelValue', latex)
            },
        },
    })
    if (props.modelValue) field.latex(props.modelValue)
    // the initial value is where undo stops, not an edit to undo
    history.splice(0, history.length, { latex: field.latex() })
    historyIndex = 0
    el.value.addEventListener('keydown', onKeydown)
    for (const type of ['keydown', 'mousedown', 'paste', 'cut'] as const) {
        el.value.addEventListener(type, rememberCursor, capture)
    }
})

watch(
    () => props.modelValue,
    (latex) => {
        if (field && field.latex() !== latex) field.latex(latex)
    }
)

onBeforeUnmount(() => {
    el.value?.removeEventListener('keydown', onKeydown)
    for (const type of ['keydown', 'mousedown', 'paste', 'cut'] as const) {
        el.value?.removeEventListener(type, rememberCursor, capture)
    }
    field?.revert()
    field = null
})
</script>
