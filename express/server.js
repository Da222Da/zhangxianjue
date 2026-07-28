const express = require("express");
const cors = require("cors");

const adminArticleRouter = require("./routes/admin/article.js");
const app = express();
const PORT = process.env.PORT || 3000;
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler"); // 导入错误处理中间件

app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析 JSON 请求体
app.use(express.urlencoded({ extended: false })); // 解析 URL 编码
app.use(express.static("public")); // 静态文件目录

// 注册 admin 文章路由
app.use("/admin/article", adminArticleRouter);

// ========== 404 Not Found 找不到接口（放在所有路由之后） ==========
app.use(notFoundHandler);

// ========== 统一错误处理（放在最后） ==========
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 服务器启动在 http://localhost:${PORT}`);
});
