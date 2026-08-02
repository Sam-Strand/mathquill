import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
    plugins: [
        dts({
            skipDiagnostics: true,
            logLevel: 'error', 
        })
    ],
    build: {
        lib: {
            entry: 'src/index.ts',
            name: 'mathquill',
            formats: ['es']
        },
        rollupOptions: {
            output: {
                exports: 'named'
            }
        }
    }
})
