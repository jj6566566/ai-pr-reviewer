/**
 * @file src/App.tsx
 * @description 应用根组件 - 配置路由表
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';

/**
 * App 路由配置：
 * - /          -> Dashboard 主页
 * - 未匹配路由  -> 重定向到 /
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
