import configVue from 'vite-preset/vue'
import mkon from 'mkon/vite-plugin-mkon'

export default configVue({
    entry: {
        index: 'src/index.ts',
        vue: 'src/vue/index.ts'
    },
    plugins: [
        mkon(),
    ],
})
