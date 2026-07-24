import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import { defineConfig } from 'electron-vite'

export default defineConfig({
    main: {
        server: {
            headers: {
                'Content-Security-Policy':
                    "default-src * 'unsafe-inline' 'unsafe-eval'; connect-src *;"
            }
        },
        resolve: {
            alias: {
                '@shared': resolve(__dirname, 'src/shared')
            }
        }
    },
    preload: {
        resolve: {
            alias: {
                '@shared': resolve(__dirname, 'src/shared')
            }
        }
    },
    renderer: {
        resolve: {
            alias: {
                '@renderer': resolve('src/renderer/src'),
                '@shared': resolve(__dirname, 'src/shared')
            }
        },
        plugins: [
            vue(),
            tailwindcss(),
            Components({
                resolvers: [PrimeVueResolver()],
                dirs: ['src/renderer/src/*/ui/*']
            })
        ]
    }
})
