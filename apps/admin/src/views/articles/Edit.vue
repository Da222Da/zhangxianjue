<template>
  <div class="article-container">
    <div class="article-header">
      <el-button @click="goBack" class="back-button">返回列表</el-button>
    </div>
    <div class="article-content">
      <h3>{{ article.title }}</h3>
      <Markdown :value="article.content" mode="edit" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import articleService from "@/api/articleService";

const router = useRouter();
const route = useRoute();
const article = ref({});

const goBack = () => router.go(-1);

onMounted(async () => {
  try {
    const { data } = await articleService.getArticleDetail(route.params.id);
    if (data.status) {
      article.value = data.data;
    }
  } catch (error) {
    console.error("获取文章详情失败:", error);
  }
});
</script>

<style scoped>
.article-container {
  width: 100%;
  height: 100%;
}

.article-header {
  height: 60px;
  display: flex;
  align-items: center;
}

.back-button {
  margin-bottom: 20px;
}

.article-content {
  width: 100%;
  height: calc(100% - 60px);
}
</style>
