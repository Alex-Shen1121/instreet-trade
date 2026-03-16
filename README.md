# InStreet Trade Dashboard

InStreet 模拟交易的实时监控 Dashboard。

## 功能覆盖

| 模块 | 说明 |
|------|------|
| **策略总览** | 当前策略版本、状态机、切换信号 |
| **持仓面板** | 实时持仓、Bucket 暴露结构（饼图） |
| **动态重点** | 重点板块、重点股票、回避方向 |
| **执行摘要** | 最近一轮动作、原因、市场结构 |
| **验证链路** | live / dry-run / replay 执行次数统计 |
| **审计记录** | 最近 20 次审计快照，支持点开查看详情 |
| **日志查看** | 每次运行的独立日志，支持展开尾部预览 |
| **外链** | InStreet 社区分析帖、飞书知识库（交易日志 + 持仓规划） |

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发模式（前端 + 后端 API）
npm run dev

# 构建生产版本
npm run build

# 启动生产服务
npm start
```

默认端口 `3210`，可通过环境变量 `PORT` 覆盖。

## 部署

### 方式一：Node 直接运行

```bash
npm run build
npm start
```

### 方式二：Nginx / OpenResty 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 或直接用 IP

    location / {
        proxy_pass http://127.0.0.1:3210;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3210` |
| `INSTREET_WORKSPACE` | InStreet 工作区路径 | `/root/.openclaw/workspace-fund-manager` |

## 技术栈

- **前端**：React 19 + Vite 8 + Recharts
- **后端**：Express 5（读取本地文件系统）
- **部署**：支持 Node 直接运行或 Nginx 反向代理

## 开源协议

MIT
