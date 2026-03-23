import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

const isProduction = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [
    build(),
    // devServer는 빌드 모드에서 완전히 제외
    ...(isProduction
      ? []
      : [devServer({ adapter, entry: 'src/index.tsx' })]
    ),
  ],
  build: {
    sourcemap: false,
    minify: true,
    rollupOptions: {
      treeshake: true,
    },
  },
})
