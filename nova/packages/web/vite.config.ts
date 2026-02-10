import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        timeout: 300000,       // 5 分钟代理超时，适配 LLM 长请求
      },
      '/health': {
        target: 'http://localhost:7001',
        changeOrigin: true,
      },
    },
  },
});
