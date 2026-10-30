import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // The whole app lives under /QuestlyTaskApp/ (e.g. /QuestlyTaskApp/home). The API stays at /api.
  base: process.env.VITE_BASE_PATH ?? '/QuestlyTaskApp/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
