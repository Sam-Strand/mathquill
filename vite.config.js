import { vueLib } from 'vite-lib-preset'
import mkon from 'mkon/vite-plugin-mkon'

export default vueLib({
    entry: {
        index: 'src/index.ts',
        vue: 'src/vue/index.ts'
    },
    plugins: [
        mkon(),
    ],
})
