# 项目说明与打包指南

## 1. 目录结构说明
- `main.py`：项目启动入口（使用 Flask 启动网页服务）。
- `core/`：核心业务逻辑。
  - `api/`：所有的外部接口调用代码（如京东查询接口等）。
  - `services/`：所有的业务处理代码（如文件解析、去重、数据剔除等）。
- `ui/`：前端界面文件。
  - `templates/`：HTML 页面文件。
  - `static/`：CSS、JS 和图片文件。
- `utils/`：通用工具类（如日志配置、文件系统操作助手）。
- `config/`：配置文件（存放全局变量、Cookie配置模板等）。
- `logs/`：程序运行日志存放处。
- `data/output/`：程序处理生成的 Excel/CSV 结果文件存放处。
- `docs/`：项目相关文档（如 API 接口说明文档等）。

## 2. Windows 封装为 EXE 指南 (待后续代码写完后执行)
由于您需要在 Windows 电脑上将此项目封装为 `.exe` 文件，我们推荐使用 `PyInstaller`。

在 Windows 电脑上打开终端并进入本文件夹后：
1. 安装依赖：`pip install -r requirements.txt`
2. 安装打包工具：`pip install pyinstaller`
3. 执行打包命令：
   ```bash
   pyinstaller --noconfirm --onedir --windowed --add-data "ui/templates;ui/templates" --add-data "ui/static;ui/static" main.py
   ```
*(具体打包参数会根据后续最终代码做微调)*

## 3. 本地启动（开发/调试）
在本目录执行：
```bash
python main.py
```

如果端口 5000 被占用，可指定端口：
```bash
PORT=5001 python main.py
```
