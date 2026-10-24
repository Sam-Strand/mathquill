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
import type { Config, MathFieldApi } from '..'

const props = withDefaults(defineProps<{ modelValue?: string; config?: Config }>(), {
    modelValue: '',
    config: () => ({}),
})
const emit = defineEmits<{ 'update:modelValue': [latex: string] }>()

const MAX_HISTORY = 100

const el = ref<HTMLElement | null>(null)
let field: MathFieldApi | null = null
let restoring = false
const history: string[] = ['']
let historyIndex = 0

function restore(index: number) {
    if (!field || index < 0 || index >= history.length) return
    restoring = true
    historyIndex = index
    field.latex(history[index])
    restoring = false
}

function record(latex: string) {
    history.splice(historyIndex + 1) // drop the redo branch
    history.push(latex)
    if (history.length > MAX_HISTORY) history.shift()
    historyIndex = history.length - 1
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
                record(latex)
                emit('update:modelValue', latex)
            },
        },
    })
    if (props.modelValue) field.latex(props.modelValue)
    el.value.addEventListener('keydown', onKeydown)
})

watch(
    () => props.modelValue,
    (latex) => {
        if (field && field.latex() !== latex) field.latex(latex)
    }
)

onBeforeUnmount(() => {
    el.value?.removeEventListener('keydown', onKeydown)
    field?.revert()
    field = null
})
</script>
