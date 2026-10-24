// Module shims for non-TS imports handled by Vite.
declare module '*.scss'
declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<object, object, unknown>
    export default component
}

