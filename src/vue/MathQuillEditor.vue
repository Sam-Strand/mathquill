<template>
    <span ref="mathFieldRef"></span>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import MathQuill from '..'

const props = defineProps({
    modelValue: {
        type: String,
        default: ''
    },
    config: {
        type: Object,
        default: () => ({})
    }
})

const emit = defineEmits(['update:modelValue'])

const mathFieldRef = ref(null)
let mathField = null
let isRestoring = false
const history = ['']
let historyIndex = 0
const MAX_HISTORY = 100

function applyHistoryState(index) {
    if (index >= 0 && index < history.length) {
        isRestoring = true
        historyIndex = index
        const latex = history[historyIndex]
        mathField.latex(latex)
        isRestoring = false
    }
}
function onKeydown(e) {
    const active = document.activeElement
    if (!mathFieldRef.value?.contains(active)) return

    // Ctrl+Z - Undo
    if (e.code === 'KeyZ' && e.ctrlKey) {
        e.preventDefault()
        if (historyIndex > 0) {
            applyHistoryState(historyIndex - 1)
        }
    }

    // Ctrl+Y
    if (e.code === 'KeyY' && e.ctrlKey) {
        e.preventDefault()
        if (historyIndex < history.length - 1) {
            applyHistoryState(historyIndex + 1)
        }
    }
}

onMounted(() => {
    const el = mathFieldRef.value
    if (!el) return

    const defaultConfig = {
        spaceBehavesLikeTab: true,
        handlers: {
            edit: () => {
                if (isRestoring) return

                const latex = mathField.latex()

                if (historyIndex < history.length - 1) {
                    history.splice(historyIndex + 1)
                }

                history.push(latex)

                if (history.length > MAX_HISTORY) {
                    history.shift()
                }

                historyIndex = history.length - 1
                emit('update:modelValue', latex)
            }
        },
        ...props.config
    }

    mathField = MathQuill.MathField(el, defaultConfig)

    if (props.modelValue) {
        mathField.latex(props.modelValue)
    }
    document.addEventListener('keydown', onKeydown)
})

watch(
    () => props.modelValue,
    (newLatex) => {
        if (mathField && mathField.latex() !== newLatex) {
            mathField.latex(newLatex)
        }
    }
)

onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
})
</script>