import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    resolve: {
        alias: {
            '@mathquill': '/src'
        }
    },
    plugins: [
        vue(),
        dts()
    ],
    build: {
        lib: {
            entry: {
                index: 'src/index.ts',
                vue: 'src/vue/index.ts'
            },
            name: 'mathquill',
            formats: ['es']
        },
        rollupOptions: {
            external: ['vue'],
            output: {
                exports: 'named'
            }
        }
    }
})
