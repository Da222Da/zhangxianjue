// src/models/index.ts
import sequelize from "./connection.ts";
import Article from "./article.ts";
import Category from "./category.ts";
import Note from "./note.ts";
import TimelineEvent from "./timelineEvent.ts";
import Users from "./users.ts";

// ===== 关联 =====
// 统一在 barrel 里定义，避免各模型文件互相 import 造成循环依赖。
// 别名固定为 categoryRef，避免与响应体里的扁平字段 category（分类名）重名。
Article.belongsTo(Category, { as: "categoryRef", foreignKey: "category_id", targetKey: "id" });
Note.belongsTo(Category, { as: "categoryRef", foreignKey: "category_id", targetKey: "id" });
// 文章 → 关联笔记：只为取标题（client 的「前往笔记」链接与 admin 表格列都要显示它）
Article.belongsTo(Note, { as: "noteRef", foreignKey: "note_id", targetKey: "id" });

export { sequelize, Article, Category, Note, TimelineEvent, Users };
// 供 service 层直接引用实体类型，避免各处 import 深路径
export type { ArticleAttributes, ArticleCreationAttributes } from "./article.ts";
export type { CategoryAttributes, CategoryCreationAttributes } from "./category.ts";
export type { NoteAttributes, NoteCreationAttributes } from "./note.ts";
export type { TimelineButton, TimelineEventAttributes, TimelineEventCreationAttributes } from "./timelineEvent.ts";
export type { UsersAttributes } from "./users.ts";
