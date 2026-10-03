import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// 开发/演示：VITE_API_BASE 未配置时启用内置 Mock 后端（契约见 openapi.yaml）
if (!import.meta.env.VITE_API_BASE) {
  void import('./mocks/mockServer').then(({ installMockFetch }) => installMockFetch());
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
