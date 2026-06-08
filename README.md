# AI 简历优化工具

AI驱动的简历优化工具，参考求职方舟 (qiuzhifangzhou.com) 设计。

## 功能

- **AI通用优化**：美化语言、量化成果、增强专业表达
- **AI专岗优化**：根据目标岗位JD定向优化关键词和技能描述
- **版本管理**：原始版/优化版切换、对比、删除
- **版本PK**：双版本并排对比差异
- **简历诊断**：AI分析简历问题并给出修改建议
- **PDF下载**：导出当前版本为PDF
- **Markdown编辑**：实时预览的Markdown编辑器
- **用户认证**：Supabase Auth（注册/登录）

## 技术栈

- Next.js 16 (App Router) + TypeScript
- shadcn/ui + Tailwind CSS v4
- Supabase (Auth + PostgreSQL)
- DeepSeek V4 Flash API
- react-markdown

## 快速开始

### 1. 安装依赖

```bash
cd "AI Resume Translation"
npm install
```

### 2. 配置环境变量

编辑 `.env.local`：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

### 3. 初始化数据库

在 Supabase SQL Editor 中执行 `supabase/schema.sql`。

### 4. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── optimize/route.ts    # AI优化API
│   │   └── diagnose/route.ts    # 简历诊断API
│   ├── globals.css              # Tailwind样式
│   ├── layout.tsx               # 根布局
│   └── page.tsx                 # 主页面
├── components/
│   ├── ui/                      # shadcn组件
│   └── resume-preview.tsx       # 简历预览
├── lib/
│   ├── supabase.ts              # 客户端
│   ├── supabase-server.ts       # 服务端
│   └── utils.ts
├── types/index.ts
└── middleware.ts
supabase/
└── schema.sql                   # 数据库建表脚本
```
