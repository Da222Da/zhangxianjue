"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./connection.ts";
export interface ArticleAttributes {
  title: string;
  content: string;
  cover: string;
  description: string;
}
class Article extends Model<ArticleAttributes> implements ArticleAttributes {
  title!: string;
  content!: string;
  cover!: string;
  description!: string;
}
Article.init(
  {
    title: DataTypes.STRING,
    content: DataTypes.TEXT,
    cover: DataTypes.TEXT,
    description: DataTypes.TEXT,
  },
  {
    sequelize,
    modelName: "Article",
  },
);
// Associations
// Article.belongsTo(TargetModel, {
//   as: 'custom_name',
//   foreignKey: {
//     name: 'foreign_key_column_name',
//     allowNull: false,
//   },
//   onDelete: "RESTRICT",
//   foreignKeyConstraint: true,
// });
export default Article;
