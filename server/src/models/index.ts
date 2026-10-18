// src/models/index.ts
import sequelize from "./connection.ts";
import Article from "./article.ts";
import Book from "./book.ts";
import BookCategory from "./bookCategory.ts";
import BookTag from "./bookTag.ts";
import Category from "./category.ts";
import Chapter from "./chapter.ts";
import MembershipApplication from "./membershipApplication.ts";
import Note from "./note.ts";
import Permission from "./permission.ts";
import Role from "./role.ts";
import RolePermission from "./rolePermission.ts";
import Tag from "./tag.ts";
import TimelineEvent from "./timelineEvent.ts";
import Users from "./users.ts";
import Volume from "./volume.ts";

// ===== 关联 =====
// 统一在 barrel 里定义，避免各模型文件互相 import 造成循环依赖。
// 别名固定为 categoryRef，避免与响应体里的扁平字段 category（分类名）重名。
Article.belongsTo(Category, { as: "categoryRef", foreignKey: "category_id", targetKey: "id" });
Note.belongsTo(Category, { as: "categoryRef", foreignKey: "category_id", targetKey: "id" });
// 文章 → 关联笔记：只为取标题（client 的「前往笔记」链接与 admin 表格列都要显示它）
Article.belongsTo(Note, { as: "noteRef", foreignKey: "note_id", targetKey: "id" });

// ===== RBAC =====
// 别名 roleRef 避免与响应体里的扁平字段 role_name 混淆
Users.belongsTo(Role, { as: "roleRef", foreignKey: "role_id", targetKey: "id" });
Role.hasMany(Users, { as: "users", foreignKey: "role_id" });
Role.belongsToMany(Permission, {
  through: RolePermission,
  as: "permissions",
  foreignKey: "role_id",
  otherKey: "permission_id",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  as: "roles",
  foreignKey: "permission_id",
  otherKey: "role_id",
});

// ===== 书库 =====
// 层级：Book → Volume → Chapter；两级外键都在迁移里声明 ON DELETE CASCADE
Book.hasMany(Volume, { as: "volumes", foreignKey: "book_id" });
Volume.belongsTo(Book, { as: "bookRef", foreignKey: "book_id", targetKey: "id" });

Book.hasMany(Chapter, { as: "chapters", foreignKey: "book_id" });
Chapter.belongsTo(Book, { as: "bookRef", foreignKey: "book_id", targetKey: "id" });

Volume.hasMany(Chapter, { as: "chapters", foreignKey: "volume_id" });
Chapter.belongsTo(Volume, { as: "volumeRef", foreignKey: "volume_id", targetKey: "id" });

// 书籍分类：一本书最多一个分类；别名 categoryRef 与响应体的扁平字段 category（分类名）区分
Book.belongsTo(BookCategory, { as: "categoryRef", foreignKey: "category_id", targetKey: "id" });
BookCategory.hasMany(Book, { as: "books", foreignKey: "category_id" });

// 书籍标签：多对多，BookTags 是关联表
Book.belongsToMany(Tag, { through: BookTag, as: "tags", foreignKey: "book_id", otherKey: "tag_id" });
Tag.belongsToMany(Book, { through: BookTag, as: "books", foreignKey: "tag_id", otherKey: "book_id" });

// ===== 会员申请 =====
Users.hasMany(MembershipApplication, { as: "membershipApplications", foreignKey: "user_id" });
MembershipApplication.belongsTo(Users, { as: "userRef", foreignKey: "user_id", targetKey: "id" });
// 审核人也是 Users：必须用独立别名，否则会和 userRef 冲突
MembershipApplication.belongsTo(Users, { as: "reviewerRef", foreignKey: "reviewed_by", targetKey: "id" });

export {
  sequelize,
  Article,
  Book,
  BookCategory,
  BookTag,
  Category,
  Chapter,
  MembershipApplication,
  Note,
  Permission,
  Role,
  RolePermission,
  Tag,
  TimelineEvent,
  Users,
  Volume,
};
// 供 service 层直接引用实体类型，避免各处 import 深路径
export type { ArticleAttributes, ArticleCreationAttributes } from "./article.ts";
export type { BookAttributes, BookCreationAttributes } from "./book.ts";
export type { BookCategoryAttributes, BookCategoryCreationAttributes } from "./bookCategory.ts";
export type { BookTagAttributes, BookTagCreationAttributes } from "./bookTag.ts";
export type { TagAttributes, TagCreationAttributes } from "./tag.ts";
export type { CategoryAttributes, CategoryCreationAttributes } from "./category.ts";
export type { ChapterAttributes, ChapterCreationAttributes } from "./chapter.ts";
export type { MembershipApplicationAttributes, MembershipApplicationStatus } from "./membershipApplication.ts";
export type { NoteAttributes, NoteCreationAttributes } from "./note.ts";
export type { PermissionAttributes, PermissionCreationAttributes } from "./permission.ts";
export type { RoleAttributes, RoleCreationAttributes } from "./role.ts";
export type { RolePermissionAttributes } from "./rolePermission.ts";
export type { TimelineButton, TimelineEventAttributes, TimelineEventCreationAttributes } from "./timelineEvent.ts";
export type { UsersAttributes } from "./users.ts";
export type { VolumeAttributes, VolumeCreationAttributes } from "./volume.ts";
