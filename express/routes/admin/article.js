const express = require("express");
const router = express.Router();
const { Article } = require("../../models");

// 查询文章列表
router.get("/", async (req, res, next) => {
  try {
    const articles = await Article.findAll();
    res.json({
      status: true,
      data: articles,
      message: "Articles find successfully",
    });
  } catch (error) {
    next(error);
  }
});

// 创建文章接口
router.post("/", async (req, res) => {
  try {
    const { title, content } = req.body; // 从请求体中获取文章数据
    const article = await Article.create({ title, content });
    res.status(201).json({
      status: true,
      data: article,
      message: "Article created successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新文章接口
router.put("/:id", async (req, res) => {
  try {
    // 1. 从请求参数中获取文章 ID
    const { id } = req.params;

    // 2. 从请求体中获取要更新的数据
    const { title, content } = req.body;

    // 3. 查找要更新的文章
    const article = await Article.findByPk(id);

    // 4. 如果文章不存在，返回 404 错误
    if (!article) {
      return res.status(404).json({
        status: false,
        message: "Article not found",
      });
    }

    // 5. 更新文章数据
    const updatedArticle = await article.update({ title, content });

    // 6. 返回更新后的文章数据
    res.status(200).json({
      status: true,
      data: updatedArticle,
      message: "Article updated successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除文章接口
router.delete("/:id", async (req, res) => {
  try {
    // 1. 从请求参数中获取文章 ID
    const { id } = req.params;

    // 2. 查找要删除的文章
    const article = await Article.findByPk(id);

    // 3. 如果文章不存在，返回 404 错误
    if (!article) {
      return res.status(404).json({
        status: false,
        message: "Article not found",
      });
    }

    // 4. 删除文章
    await article.destroy();

    // 5. 返回成功消息，通常不需要返回数据
    res.status(200).json({
      status: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
