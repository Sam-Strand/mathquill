<template>
    <div class="math-block">
        <MathQuillEditor v-model="formula" :config="{ spaceBehavesLikeTab: false }" />
        <p>LaTeX: {{ formula }}</p>

    </div>
</template>

<script setup>
import { ref } from 'vue'
import MathQuillEditor from '@mathquill/vue'

const formula = ref('x = \\frac{ -b \\pm \\sqrt{b^2-4ac} }{ 2a }')
</script>

<style lang="scss">
:root {
    --mq-color-text: red;
}
</style>