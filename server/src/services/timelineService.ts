// src/services/timelineService.ts
import type { Order } from "sequelize";
import { TimelineEvent } from "../models/index.ts";
import type { TimelineButton, TimelineEventAttributes, TimelineEventCreationAttributes } from "../models/index.ts";
import { NotFoundError } from "../utils/errors.ts";

/** 事件标题上限，对应 VARCHAR(255) */
export const MAX_TITLE_LENGTH = 255;
/** 按钮文案上限（按钮本身很短，不必占满 255） */
export const MAX_BUTTON_TEXT_LENGTH = 50;
/** 按钮链接上限 */
export const MAX_URL_LENGTH = 1024;
/** 单个事件最多几个按钮：卡片上再多就挤不下了 */
export const MAX_BUTTONS = 5;
/** description 列类型为 TEXT，上限 65535 字节（UTF-8，中文 3 字节/字） */
export const MAX_TEXT_BYTES = 65535;
/** 年份取值范围：太早或太远的多半是输入错误 */
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

/**
 * 列表排序：年份倒序，同一年内按排序号升序、再按创建时间升序
 *
 * 时间轴天然是「新的在上、旧的在下」，同一年内用 sort 控制先后，
 * 没填 sort（默认 0）时按录入顺序排，符合补记的直觉。
 */
const LIST_ORDER: Order = [
  ["year", "DESC"],
  ["sort", "ASC"],
  ["createdAt", "ASC"],
];

/** 创建 / 更新事件的入参 */
export interface TimelineEventPayload {
  year: number;
  title: string;
  /** 不传表示不设置（创建）/ 保持原值（更新）；传 null 表示清空 */
  description?: string | null;
  /** 不传表示不设置（创建取默认值 0）/ 保持原值（更新）；传 null 或空数组表示去掉全部按钮 */
  buttons?: TimelineButton[] | null;
  /** 不传表示不设置（创建取默认值 0）/ 保持原值（更新） */
  sort?: number;
}

/** 响应体里 buttons 永远是数组（库里存 null），避免前端每处判空 */
export interface TimelineEventDto extends Omit<TimelineEventAttributes, "buttons"> {
  buttons: TimelineButton[];
}

const toDto = (row: TimelineEventAttributes): TimelineEventDto => ({
  ...row,
  buttons: row.buttons ?? [],
});

/** 空数组与 null 都落到 NULL，库里不存空数组 */
const normalizeButtons = (buttons: TimelineButton[] | null | undefined): TimelineButton[] | null =>
  buttons && buttons.length > 0 ? buttons : null;

/**
 * 查询全部事件
 *
 * ✅ 决策：**不分页**。时间轴是一份逐年记录的个人履历，规模天然很小；
 * 分页会让 client 需要额外拉取多年数据，反而复杂。
 */
export const listTimelineEvents = async (): Promise<TimelineEventDto[]> => {
  const rows = await TimelineEvent.findAll({ order: LIST_ORDER });
  return rows.map((row) => toDto(row.get({ plain: true })));
};

/**
 * 按主键取出模型实例（供更新 / 删除内部使用）
 * @throws {NotFoundError} 事件不存在
 */
const findEventOrFail = async (id: number): Promise<TimelineEvent> => {
  const event = await TimelineEvent.findByPk(id);
  if (!event) {
    throw new NotFoundError("时间轴事件不存在");
  }
  return event;
};

/** 按主键查询单条事件 */
export const getTimelineEventById = async (id: number): Promise<TimelineEventDto> =>
  toDto((await findEventOrFail(id)).get({ plain: true }));

/**
 * 创建事件
 * @param payload 已校验的事件数据
 */
export const createTimelineEvent = async (payload: TimelineEventPayload): Promise<TimelineEventDto> => {
  const event = await TimelineEvent.create({
    year: payload.year,
    title: payload.title,
    description: payload.description ?? null,
    buttons: normalizeButtons(payload.buttons),
    sort: payload.sort ?? 0,
  });
  return toDto(event.get({ plain: true }));
};

/**
 * 更新事件
 *
 * description / buttons / sort 为 undefined 时保持原值，仅在显式传入时才覆盖。
 * buttons 是**整体替换**语义：传数组就是保存这份完整列表，传空数组或 null 表示清空。
 * @throws {NotFoundError} 事件不存在
 */
export const updateTimelineEvent = async (id: number, payload: TimelineEventPayload): Promise<TimelineEventDto> => {
  const event = await findEventOrFail(id);

  const patch: Partial<TimelineEventAttributes> = {
    year: payload.year,
    title: payload.title,
  };
  if (payload.description !== undefined) {
    patch.description = payload.description;
  }
  if (payload.buttons !== undefined) {
    patch.buttons = normalizeButtons(payload.buttons);
  }
  if (payload.sort !== undefined) {
    patch.sort = payload.sort;
  }

  await event.update(patch as Partial<TimelineEventCreationAttributes>);
  return toDto(event.get({ plain: true }));
};

/**
 * 删除事件
 * @throws {NotFoundError} 事件不存在
 */
export const deleteTimelineEvent = async (id: number): Promise<void> => {
  const event = await findEventOrFail(id);
  await event.destroy();
};
