// 必须是首条 import：ESM 会先执行依赖模块，借此保证 dotenv 加载早于其它模块读取 process.env
import { PORT, UPLOAD_DIR } from "./config/env.ts";
import express from "express";
import cors from "cors";
import routes from "./routes/index.ts";
import { setupSwagger } from "./config/swagger.ts"; // 引入 swagger 配置
import { errorHandler } from "./middlewares/errorMiddleware.ts";

const app = express();

app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析 JSON 请求体
app.use(express.urlencoded({ extended: false })); // 解析 URL 编码
app.use(express.static("public")); // 静态文件目录

// 上传文件的静态访问目录
// 文件名为服务端生成的 UUID，内容不会原地变更，因此可安全长缓存
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    dotfiles: "deny",
    index: false,
    immutable: true,
    maxAge: "30d",
  }),
);

// Swagger 设置
setupSwagger(app);

// 集成路由
app.use("/api", routes);

// ========== 统一错误处理（放在最后） ==========
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 服务器启动在 http://localhost:${PORT}`);
});
