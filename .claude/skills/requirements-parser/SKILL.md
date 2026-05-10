---
name: requirements-parser
description: Parse structured project requirements (business logic, API, frontend) and guide code generation. Invoke when user provides new requirements described across business flow, API usage, and UI dimensions.
---

# 需求解析与代码生成 (Requirements Parser)

当用户从**业务流程**、**使用接口**、**前端需求**三个维度描述新需求时，此 Skill 自动激活，协助理解需求并规范化地进行后续开发。

用户也可通过 `/requirements-parser` 手动调用。

## 核心目标

将用户结构化描述的需求映射到项目的标准目录架构中，并指导后续的代码编写。

## 解析流程

### 1. 需求记录与解析

收到新需求时，首先将原始描述和解析结果记录到文档中：

- 在 `project_app/docs/` 目录下创建或更新 `需求说明文档.md`
- 按**业务流程**、**使用接口**、**前端需求**的结构清晰记录，确保历史需求可追溯

随后将需求拆解为以下部分：

| 维度 | 关注点 | 对应目录 |
|------|--------|----------|
| 业务流程 (Business Logic) | 核心逻辑、数据流转 | `project_app/core/services/` |
| 使用接口 (API) | 外部系统交互 | `project_app/core/api/` + `project_app/docs/API接口说明.md` |
| 前端需求 (UI/UX) | 页面交互与展示 | `project_app/ui/templates/` + `project_app/ui/static/` |

### 2. 生成实现计划

正式写代码前，向用户输出简明的实现计划：

1. **API 层**：如何封装外部接口
2. **Service 层**：如何实现核心业务逻辑并串联 API
3. **Controller 层** (`main.py` / `app.py`)：如何定义路由接收前端请求并调用 Service
4. **UI 层**：前端页面的设计与实现

等待用户确认计划后再开始编码。

### 3. 代码生成规范

用户确认计划后，严格按照以下目录结构生成代码：

```
project_app/
├── core/
│   ├── api/          # 外部接口封装类/函数
│   └── services/     # 核心业务逻辑
├── ui/
│   ├── templates/    # 前端 HTML
│   └── static/       # 静态资源
├── main.py           # Flask/FastAPI 服务主入口（或 app.py）
└── docs/
    ├── 需求说明文档.md
    └── API接口说明.md
```

**打包兼容性**：生成的代码需支持跨平台运行，并兼容 `PyInstaller` 打包为 Windows `.exe`（如使用动态路径获取 `os.path` 或 `pathlib`，避免硬编码绝对路径）。
