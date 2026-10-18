<!-- src/views/timeline/index.vue -->
<template>
  <el-main>
    <!-- 顶部操作栏：更新作用于表格中选中的那一行 -->
    <div class="header-actions">
      <el-button type="primary" size="small" @click="openDialog('add')">新增</el-button>
      <el-button type="primary" size="small" @click="openDialog('edit')">更新</el-button>
    </div>

    <!-- row-key 让数据刷新后尽量保住当前高亮行 -->
    <el-table :data="events" row-key="id" stripe border highlight-current-row style="width: 100%" @current-change="handleCurrentChange">
      <el-table-column label="操作" align="center" width="100" fixed="left">
        <template #default="{ row }">
          <el-button link type="danger" size="small" @click="deleteEvent(row)">删除</el-button>
        </template>
      </el-table-column>
      <el-table-column prop="year" label="年份" width="90" align="center" sortable />
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.description">{{ row.description }}</span>
          <span v-else class="empty-cell">—</span>
        </template>
      </el-table-column>
      <el-table-column label="按钮" min-width="200">
        <template #default="{ row }">
          <div v-if="row.buttons.length > 0" class="button-tags">
            <el-tag v-for="(button, index) in row.buttons" :key="index" size="small" type="info" :title="button.url">
              {{ button.text }}
            </el-tag>
          </div>
          <span v-else class="empty-cell">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="sort" label="排序" width="80" align="center" />
      <el-table-column prop="updatedAt" label="更新时间" width="180" />
    </el-table>

    <p class="table-hint">表格中选中一行后，点顶部的「更新」可修改它的年份 / 标题 / 描述 / 排序 / 自定义按钮。</p>
  </el-main>

  <TimelineDialog :type="dialogType" :modelValue="dialogVisible" :event="eventDraft" @close="dialogVisible = false" @update="fetchEvents" />
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import timelineService from "@/api/timelineService";
import TimelineDialog from "./TimelineDialog.vue";
import type { TimelineEvent, TimelineEventDraft } from "@/types/api";

type DialogType = "add" | "edit";

/** 空白草稿：新增时使用，默认年份取今年，减少一次输入 */
const emptyDraft = (): TimelineEventDraft => ({
  id: "",
  year: new Date().getFullYear(),
  title: "",
  description: null,
  buttons: [],
  sort: 0,
});

const events = ref<TimelineEvent[]>([]);
/** 表格当前选中的行，是工具栏「更新」的作用对象 */
const currentRow = ref<TimelineEvent | null>(null);

const dialogVisible = ref(false);
const dialogType = ref<DialogType>("add");
const eventDraft = reactive<TimelineEventDraft>(emptyDraft());

const fetchEvents = async (): Promise<void> => {
  try {
    const res = await timelineService.getEvents();
    events.value = res.data;

    // 刷新后把选中行换成新对象：否则「更新」会拿着上一次的陈旧数据提交
    if (currentRow.value) {
      const currentId = currentRow.value.id;
      currentRow.value = events.value.find((item) => item.id === currentId) ?? null;
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "获取时间轴失败");
  }
};

const handleCurrentChange = (row: TimelineEvent | null): void => {
  currentRow.value = row;
};

/**
 * 打开弹窗
 * - add：清空草稿
 * - edit：编辑当前选中行；未选中时提示而不是静默无反应
 */
const openDialog = (type: DialogType): void => {
  if (type === "edit") {
    if (!currentRow.value) {
      ElMessage.warning("请先在表格中选中要更新的事件");
      return;
    }
    // ⚠️ buttons 必须深拷贝：只复制引用的话，弹窗里增删按钮会直接改到表格行，
    //    用户点「关闭」后未保存的改动仍会留在列表里
    Object.assign(eventDraft, currentRow.value, {
      buttons: currentRow.value.buttons.map((button) => ({ ...button })),
    });
  } else {
    Object.assign(eventDraft, emptyDraft());
  }

  dialogType.value = type;
  dialogVisible.value = true;
};

const deleteEvent = async (row: TimelineEvent): Promise<void> => {
  try {
    await ElMessageBox.confirm(`确定删除「${row.year} · ${row.title}」？删除后不可恢复。`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    // 用户取消，不做任何事
    return;
  }

  try {
    await timelineService.deleteEvent(row.id);
    ElMessage.success("删除成功");
    if (currentRow.value?.id === row.id) {
      currentRow.value = null;
    }
    fetchEvents();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "删除失败");
  }
};

onMounted(() => {
  fetchEvents();
});
</script>

<style scoped>
.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.empty-cell {
  color: var(--el-text-color-placeholder);
}

.button-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.table-hint {
  margin-top: 12px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
