import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 分包策略（P2：#31 复核发现 antd 单 chunk 744kB 告警）：
 * - antd 与其底层 rc-* / @rc-component / dayjs 合成单一 vendor chunk，
 *   避免跨 chunk 循环引用（曾出现 antd -> rc -> antd circular chunk）；
 * - 框架、路由、查询、图标各自独立，便于长期缓存；
 * - antd vendor chunk 约 750KB（gzip ≈ 237KB）为可接受的长期缓存体积，
 *   故把 chunkSizeWarningLimit 提到 800KB 并在此说明理由，而非静默忽略。
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/antd/') ||
            id.includes('/rc-') ||
            id.includes('/@rc-component/') ||
            id.includes('/dayjs/')
          )
            return 'antd';
          if (id.includes('@phosphor-icons')) return 'phosphor';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('/react-router')) return 'router';
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/'))
            return 'vendor';
          return undefined;
        },
      },
    },
  },
});
