<template>
    <MathQuillEditor v-model="formula" :config="{ spaceBehavesLikeTab: false }" />
    <p>LaTeX: {{ formula }}</p>

</template>

<script setup>
import { ref } from 'vue'
import MathQuillEditor from '../../src/vue'

const formula = ref('x = \\frac{ -b \\pm \\sqrt{b^2-4ac} }{ 2a }')
</script>