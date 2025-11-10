import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    'global': 'globalThis',
  },
  build: {
    lib: {
      entry: 'src/main.tsx',
      name: 'InfluencerSearchWidget',
      fileName: 'component',
      formats: ['es'],
    },
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
