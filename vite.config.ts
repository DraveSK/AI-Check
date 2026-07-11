import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const siteUrl = (process.env.VITE_SITE_URL || 'https://drave-ai-check.workers.dev').replace(/\/$/, '');
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'drave-seo-meta',
      transformIndexHtml(html) {
        return html.replaceAll('%SITE_URL%', siteUrl);
      },
    },
  ],
});
