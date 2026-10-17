"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

/** 事件卡片上的一个自定义按钮 */
export interface TimelineButton {
  text: string;
  /** 站内路径或 http(s) 地址；协议白名单由 controller 校验 */
  url: string;
}

export interface TimelineEventAttributes {
  id: number;
  /** 事件所属年份，作为时间轴的分组单元 */
  year: number;
  title: string;
  description: string | null;
  /** 自定义按钮数组，顺序即展示顺序；null 表示没有按钮 */
  buttons: TimelineButton[] | null;
  /** 同一年内的排序号，升序 */
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

// 创建时，id 与时间戳由 Sequelize 生成；其余业务字段允许缺省
export type TimelineEventCreationAttributes = Optional<
  TimelineEventAttributes,
  "id" | "createdAt" | "updatedAt" | "description" | "buttons" | "sort"
>;

class TimelineEvent
  extends Model<TimelineEventAttributes, TimelineEventCreationAttributes>
  implements TimelineEventAttributes
{
  declare id: number;
  declare year: number;
  declare title: string;
  declare description: string | null;
  declare buttons: TimelineButton[] | null;
  declare sort: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

TimelineEvent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    // MySQL 的 JSON 列；mysql2 会自动把结果解析成 JS 数组/对象
    buttons: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    sort: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // 显式声明时间戳列，与迁移文件保持一致的 allowNull 约束
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "TimelineEvent",
  },
);

export default TimelineEvent;
