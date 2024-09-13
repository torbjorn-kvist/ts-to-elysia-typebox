import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  clean: true,
  treeshake: true,
  // minify: true,
  shims: true,
  watch: process.env.WATCH === 'true' ? 'src' : false,
})
