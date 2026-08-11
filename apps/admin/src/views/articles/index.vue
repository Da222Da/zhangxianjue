<!-- src/views/roles/index.vue -->
<template>
  <el-main>
    <!-- 顶部操作栏：响应式对齐 -->
    <div class="header-actions">
      <el-button type="primary" size="small" @click="openDialog('add')">新增</el-button>
    </div>
    <el-table :data="articles" stripe border style="width: 100%">
      <el-table-column prop="title" label="标题" show-overflow-tooltip />
      <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="创建时间" />
      <el-table-column prop="updatedAt" label="更新时间" />
      <el-table-column label="操作" align="center" min-width="160">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button link type="primary" size="small" @click="openDialog('view', row)">详情</el-button>
            <el-button link type="primary" size="small" @click="openDialog('edit', row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="deleteArticle(row.id)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </el-main>

  <ArticlesDialog :type="dialogType" :markdownMode="markdownMode" :modelValue="articlesAddDialogVisible" :articles="articlesInfo" @close="articlesAddDialogVisible = false" @update="fetchArticles" />
  <ArticlesDialog :type="dialogType" :markdownMode="markdownMode" :modelValue="articlesDetailsDialogVisible" :articles="articlesInfo" @close="articlesDetailsDialogVisible = false" />
  <ArticlesDialog :type="dialogType" :markdownMode="markdownMode" :modelValue="articlesEditDialogVisible" :articles="articlesInfo" @close="articlesEditDialogVisible = false" @update="fetchArticles" />
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import articleService from "@/api/articleService";
import ArticlesDialog from "./ArticlesDialog.vue";

const articles = ref([]);
const dialogType = ref("view");
const articlesAddDialogVisible = ref(false); // 新增文章
const articlesDetailsDialogVisible = ref(false); // 查看文章
const articlesEditDialogVisible = ref(false); // 编辑文章
const markdownMode = ref("preview"); // Markdown 模式
const articlesDialogVisible = ref(false);
let articlesInfo = reactive({
  id: "",
  title: "",
  content: "",
});
const router = useRouter();

// 获取文章列表
const fetchArticles = async () => {
  try {
    const res = await articleService.getArticle();
    articles.value = res.data;
  } catch (error: any) {
    ElMessage.error(error.message);
  }
};

// 打开弹框
const openDialog = (type, row) => {
  dialogType.value = type;

  switch (type) {
    case "add":
      articlesAddDialogVisible.value = true;
      markdownMode.value = "add";
      articlesInfo = {
        id: "",
        title: "",
        content: "",
      };
      break;
    case "view":
      articlesDetailsDialogVisible.value = true;
      markdownMode.value = "preview";
      articlesInfo = row;
      break;
    case "edit":
      articlesEditDialogVisible.value = true;
      markdownMode.value = "edit";
      articlesInfo = row;
      break;
  }
};

const deleteArticle = async (id) => {
  try {
    await articleService.deleteArticle(id);
    ElMessage.success("删除成功");
    fetchArticles();
  } catch (error: any) {
    ElMessage.error(error.message);
  }
};

// 在组件挂载时获取文章列表
onMounted(() => {
  fetchArticles();
});
</script>

<style scoped>
.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
  /* 在移动端可以考虑改为 space-between，如果左侧有标题的话 */
}

.action-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px; /* 按钮间距 */
  flex-wrap: wrap; /* 允许换行，防止极窄屏幕下溢出 */
}
</style>
