import { cpSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  worker: {format: 'iife'},
  plugins: [react(), {
    name: 'copy-litert-wasm',
    closeBundle() {
      const target=resolve('dist/wasm')
      mkdirSync(target,{recursive:true})
      cpSync(resolve('node_modules/@litertjs/core/wasm'),target,{recursive:true})
      // Emscripten resolves the binary relative to the classic worker URL, not
      // the imported loader's URL. Vite emits that worker under /assets/.
      for (const name of ['litert_wasm_internal.wasm', 'litert_wasm_compat_internal.wasm']) {
        cpSync(resolve('node_modules/@litertjs/core/wasm', name), resolve('dist/assets', name))
      }
    },
  }],
})
