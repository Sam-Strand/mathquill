import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import vue from '@vitejs/plugin-vue'
import mkon from 'mkon/vite-plugin-mkon'

export default defineConfig({
    plugins: [
        mkon(),
        vue(),
        dts()
    ],
    build: {
        lib: {
            entry: {
                index: 'src/index.ts',
                vue: 'src/vue/index.ts'
            },
            formats: ['es']
        },
        rollupOptions: {
            external: id => id === 'vue' || id.startsWith('vue/'),
            output: {
                exports: 'named'
            }
        }
    }
})
