import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    server: {
        host: "::",
        port: 3000,
    },
    plugins: [
        react(),
        mode === 'development' &&
        componentTagger(),
    ].filter(Boolean),
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-pdf': ['jspdf', 'jspdf-autotable'],
                    'vendor-excel': ['xlsx'],
                    'vendor-ui': ['lucide-react', 'framer-motion'],
                    'vendor-supabase': ['@supabase/supabase-js'],
                }
            }
        }
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
}));
