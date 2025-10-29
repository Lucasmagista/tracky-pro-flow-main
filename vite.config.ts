import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks (bibliotecas grandes)
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          'chart-vendor': ['recharts'],
          'form-vendor': ['react-hook-form', 'zod'],
          'supabase-vendor': ['@supabase/supabase-js'],
          
          // Feature chunks (por área da aplicação)
          'dashboard': [
            './src/pages/Dashboard.tsx',
            './src/components/MetricCard.tsx',
          ],
          'analytics': [
            './src/pages/Analytics.tsx',
          ],
          'settings': [
            './src/pages/Settings.tsx',
            './src/pages/Profile.tsx',
          ],
          'integrations': [
            './src/pages/callbacks/NuvemshopCallback.tsx',
            './src/pages/callbacks/MercadoLivreCallback.tsx',
            './src/pages/callbacks/ShopifyCallback.tsx',
          ],
        },
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 1000, // 1MB warning
    // Minify
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production', // Remove console.log em produção
        drop_debugger: mode === 'production',
      },
    },
  },
}));
