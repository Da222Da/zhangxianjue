<!-- src/views/timeline/TimelineDialog.vue -->
<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="640px" @close="handleClose" destroy-on-close>
    <el-form label-width="88px" class="timeline-form">
      <el-form-item label="年份">
        <el-input-number v-model="year" :min="MIN_YEAR" :max="MAX_YEAR" :step="1" :precision="0" controls-position="right" />
        <span class="form-hint">时间轴按年份分组，同一年内按「排序」升序</span>
      </el-form-item>

      <el-form-item label="标题">
        <el-input v-model="title" maxlength="255" placeholder="这一年发生了什么" />
      </el-form-item>

      <el-form-item label="描述">
        <el-input v-model="description" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="补充细节，会展示在卡片正文里" />
      </el-form-item>

      <el-form-item label="排序">
        <el-input-number v-model="sort" :min="0" :step="1" controls-position="right" />
        <span class="form-hint">数字越小越靠前，0 表示未排版</span>
      </el-form-item>

      <el-form-item label="自定义按钮">
        <div class="button-list">
          <TimelineButtonRow v-for="(btn, index) in buttons" :key="index" :button="btn" @remove="removeButton(index)" />

          <div class="button-actions">
            <el-button link type="primary" :disabled="buttons.length >= MAX_BUTTONS" @click="addButton">+ 添加按钮</el-button>
            <span class="form-hint">顺序即展示顺序；每个按钮的文案与链接都要填；最多 {{ MAX_BUTTONS }} 个</span>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button type="primary" :loading="saving" @click="handleSubmit">{{ props.type === "edit" ? "更新" : "新增" }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import timelineService from "@/api/timelineService";
import TimelineButtonRow from "./TimelineButtonRow.vue";
import type { TimelineEventDraft, TimelineEventPayload } from "@/types/api";

/** 与服务端 timelineService 的取值范围保持一致 */
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const MAX_BUTTONS = 5;

const props = defineProps<{
  /** 弹窗形态：新增 / 更新 */
  type: "add" | "edit";
  modelValue: boolean;
  /** 与父级共享的草稿对象，弹窗直接读写其字段 */
  event: TimelineEventDraft;
}>();

const emit = defineEmits<{
  close: [];
  update: [];
}>();

const visible = ref(props.modelValue);
const saving = ref(false);

const dialogTitle = computed(() => (props.type === "edit" ? "更新时间轴事件" : "新增时间轴事件"));

/** 年份：服务端要求整数，el-input-number 清空时会给 null，这里兜底为当前年 */
const year = computed({
  get: () => props.event.year,
  set: (val: number | null) => {
    props.event.year = val ?? new Date().getFullYear();
  },
});

const title = computed({
  get: () => props.event.title,
  set: (val: string) => {
    props.event.title = val;
  },
});

const description = computed({
  get: () => props.event.description ?? "",
  set: (val: string) => {
    props.event.description = val ? val : null;
  },
});

const sort = computed({
  get: () => props.event.sort ?? 0,
  set: (val: number | null) => {
    props.event.sort = val ?? 0;
  },
});

/** 按钮列表：草稿里的数组本身是响应式的，直接增删即可 */
const buttons = computed(() => props.event.buttons);

const addButton = (): void => {
  if (props.event.buttons.length >= MAX_BUTTONS) {
    return;
  }
  props.event.buttons.push({ text: "", url: "" });
};

const removeButton = (index: number): void => {
  props.event.buttons.splice(index, 1);
};


const handleClose = (): void => {
  emit("close");
  visible.value = false;
};

/**
 * 提交
 *
 * ⚠️ 按钮文案与链接**永远成对提交**（哪怕只有一个有值也先在前端拦下）：
 * 服务端会把「只给一半」判成 400，前端提前提示能少一次往返。
 */
const handleSubmit = async (): Promise<void> => {
  const trimmedTitle = title.value.trim();
  if (!trimmedTitle) {
    ElMessage.warning("请输入事件标题");
    return;
  }

  // 整行为空的按钮视为未填写、直接丢弃；只填一半的则拦下
  const rows = props.event.buttons.map((button) => ({ text: button.text.trim(), url: button.url.trim() }));
  if (rows.some((button) => Boolean(button.text) !== Boolean(button.url))) {
    ElMessage.warning("每个按钮的文案与链接都必须填写");
    return;
  }
  const buttons = rows.filter((button) => button.text && button.url);

  saving.value = true;
  try {
    const payload: TimelineEventPayload = {
      year: year.value,
      title: trimmedTitle,
      description: description.value?.trim() ? description.value.trim() : null,
      buttons: buttons.length > 0 ? buttons : null,
      sort: sort.value,
    };

    if (props.type === "edit") {
      await timelineService.updateEvent(Number(props.event.id), payload);
      ElMessage.success("事件更新成功");
    } else {
      await timelineService.createEvent(payload);
      ElMessage.success("事件新增成功");
    }

    handleClose();
    emit("update");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
};

watch(
  () => props.modelValue,
  (newVal: boolean) => {
    if (newVal) {
      visible.value = true;
    }
  },
);
</script>

<style scoped>
.timeline-form {
  margin-bottom: 4px;
}

.form-hint {
  margin-left: 8px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.button-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.button-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 600px) {
  .form-hint {
    width: 100%;
    margin-left: 0;
  }
}
</style>
