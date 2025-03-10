import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import rollupNodePolyFill from 'rollup-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      components: path.resolve(__dirname, 'src/components/'),
      pages: path.resolve(__dirname, 'src/pages/'),
      utils: path.resolve(__dirname, 'src/utils/'),
      hooks: path.resolve(__dirname, 'src/hooks/'),
      contexts: path.resolve(__dirname, 'src/contexts/'),
      assets: path.resolve(__dirname, 'src/assets/'),
      contracts: path.resolve(__dirname, 'src/contracts/'),
      // Add polyfills for node modules
      stream: 'rollup-plugin-node-polyfills/polyfills/stream',
      buffer: 'rollup-plugin-node-polyfills/polyfills/buffer',
      util: 'rollup-plugin-node-polyfills/polyfills/util',
      process: 'rollup-plugin-node-polyfills/polyfills/process-es6',
      events: 'rollup-plugin-node-polyfills/polyfills/events',
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis'
      },
      // Enable esbuild polyfill plugins
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true
        }),
        NodeModulesPolyfillPlugin()
      ]
    }
  },
  // Define global variables for the client
  define: {
    'process.env.REACT_APP_API_URL': JSON.stringify('http://localhost:3005/api'),
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:3005/api'),
  },
  build: {
    rollupOptions: {
      plugins: [
        // Enable rollup polyfills plugin
        rollupNodePolyFill()
      ]
    },
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 3001,
    open: true,
    host: true
  }
}); 