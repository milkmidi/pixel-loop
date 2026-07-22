import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isProduction = process.env.NODE_ENV === "production";
export default defineConfig({
  base: isProduction ? "/pixel-loop/" : "/",
  plugins: [react(), tailwindcss()],
})
