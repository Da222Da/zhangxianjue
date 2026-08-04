<!-- src/views/roles/index.vue -->
<template>
  <div class="roles-container">
    <el-card>
      <el-table :data="articles">
        <el-table-column prop="title" label="标题" width="180" />
        <el-table-column prop="content" label="内容" />
        <el-table-column prop="createdAt" label="创建时间" width="250" />
        <el-table-column prop="updatedAt" label="更新时间" width="250" />
        <el-table-column fixed="right" label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleDetail(row)"> 详情 </el-button>
            <!-- <el-button link type="primary" size="small">编辑</el-button> -->
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import articleService from "@/api/articleService";

const articles = ref([]);
const router = useRouter();

// 获取文章列表
const fetchArticles = async () => {
  try {
    const { data } = await articleService.getArticle();
    if (data.status) {
      articles.value = data.data?.length ? data.data : [];
    }
  } catch (error: any) {
    ElMessage.error(error.message);
  }
};

// 查看文章详情
const handleDetail = (article) => {
  router.push({
    name: "ArticleDetail",
    params: {
      id: article.id, // 唯一标识 id 字段
    },
  });
};

// 在组件挂载时获取文章列表
onMounted(() => {
  fetchArticles();
});
</script>
