const express = require("express");
const router = express.Router();
const { Article } = require("../../models");
const { NotFoundError } = require("../../utils/errors");
const { Op } = require("sequelize");

// 查询文章列表
router.get("/", async (req, res, next) => {
  try {
    // 1. 获取查询参数
    const { keyword, page = 1, pageSize = 10 } = req.query;

    // 2. 参数类型转换与默认值处理
    const currentPage = parseInt(page, 10) || 1; // 当前页码，默认为 1
    const limit = parseInt(pageSize, 10) || 10; // 每页条数，默认为 10
    const offset = (currentPage - 1) * limit; // 偏移量（跳过多少条）

    // 3. 构造 Sequelize 查询条件
    const whereCondition = {};

    // 模糊查询条件：假设我们对 title 和 content 字段进行模糊搜索
    if (keyword) {
      // whereCondition.title = { [Op.like]: `%${keyword}%` };
      whereCondition[Op.or] = [{ title: { [Op.like]: `%${keyword}%` } }, { content: { [Op.like]: `%${keyword}%` } }];
    }

    // 4. 执行查询（使用 findAndCountAll 获取数据总数和列表）
    const { count, rows } = await Article.findAndCountAll({
      where: whereCondition,
      limit: limit,
      offset: offset,
      order: [["createdAt", "DESC"]], // 排序规则：按创建时间倒序
    });

    // 5. 返回分页格式的数据
    res.json({
      status: true,
      data: rows, // 当前页的数据列表
      total: count, // 数据库中符合条件的总记录数
      currentPage: currentPage, // 当前页码
      pageSize: limit, // 每页条数
      message: "Articles fetched successfully",
    });
  } catch (error) {
    next(error);
  }
});

// 查询文章详情
router.get("/:id", async (req, res, next) => {
  try {
    // 1. 从 URL 路径中获取文章 ID
    const { id } = req.params;

    // 2. 根据主键 ID 查询单条数据
    // 使用 findByPk (Find By Primary Key) 是 Sequelize 提供的根据主键查询的便捷方法
    const article = await Article.findByPk(id);

    // 3. 判断文章是否存在
    if (!article) {
      throw new NotFoundError("Article not found");
    }

    // 4. 文章存在，返回文章详情数据
    res.json({
      status: true,
      data: article,
      message: "Article fetched successfully",
    });
  } catch (error) {
    // 捕获异常（例如数据库连接错误、ID格式不合法等）
    next(error);
  }
});

// 创建文章接口
router.post("/", async (req, res, next) => {
  try {
    const { title, content } = req.body; // 从请求体中获取文章数据
    const article = await Article.create({ title, content });
    res.status(201).json({
      status: true,
      data: article,
      message: "Article created successfully",
    });
  } catch (error) {
    next(error);
  }
});

// 更新文章接口
router.put("/:id", async (req, res, next) => {
  try {
    // 1. 从请求参数中获取文章 ID
    const { id } = req.params;

    // 2. 从请求体中获取要更新的数据
    const { title, content } = req.body;

    // 3. 查找要更新的文章
    const article = await Article.findByPk(id);

    // 4. 如果文章不存在，返回 404 错误
    if (!article) {
      throw new NotFoundError("Article not found");
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
    next(error);
  }
});

// 删除文章接口
router.delete("/:id", async (req, res, next) => {
  try {
    // 1. 从请求参数中获取文章 ID
    const { id } = req.params;

    // 2. 查找要删除的文章
    const article = await Article.findByPk(id);

    // 3. 如果文章不存在，返回 404 错误
    if (!article) {
      throw new NotFoundError("Article not found");
    }

    // 4. 删除文章
    await article.destroy();

    // 5. 返回成功消息，通常不需要返回数据
    res.status(200).json({
      status: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
