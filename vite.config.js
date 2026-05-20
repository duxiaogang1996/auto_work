import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/ui/static',
  base: '/static/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: 'src/ui/static/index.js',
      output: {
        entryFileNames: 'assets/index.js',
      },
    },
  },
});
