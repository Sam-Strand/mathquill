import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import vue from '@vitejs/plugin-vue'
import hjson from 'hjson/vite-plugin-hjson'

export default defineConfig({
    // Относительные пути к шрифтам в собранном CSS: файлы лежат рядом в dist
    // и подхватываются сборщиком приложения
    base: './',
    resolve: {
        alias: {
            '@mathquill': '/src'
        }
    },
    plugins: [
        hjson(),
        vue(),
        dts()
    ],
    build: {
        // Шрифты кладутся в dist/ рядом с mathquill.css. С каталогом по умолчанию
        // ('assets') Vite писал в CSS url(../Symbola.woff2) — мимо файла.
        assetsDir: '',
        lib: {
            entry: {
                index: 'src/index.ts',
                vue: 'src/vue/index.ts'
            },
            name: 'mathquill',
            formats: ['es'],
            cssFileName: 'mathquill'
        },
        rollupOptions: {
            external: id => id === 'vue' || id.startsWith('vue/'),
            output: {
                exports: 'named',
                // Lib-режим выносит CSS в отдельный файл и теряет на него ссылку из JS.
                // Возвращаем её в оба входа: и в mathquill, и в mathquill/vue
                banner: chunk => chunk.isEntry ? `import './mathquill.css'` : ''
            }
        }
    }
})
