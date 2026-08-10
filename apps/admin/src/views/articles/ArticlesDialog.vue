<template>
  <el-dialog v-if="visiable" v-model="visiable" :title="articles.title" width="80%" @close="handleColse">
    <div style="height: 65vh">
      <Markdown :value="articles.content" :mode="articles.mode" ref="markdownRef" />
    </div>
    <template #footer>
      <div v-if="articles.mode === 'edit'">
        <el-button @click="handleColse">关闭</el-button>
        <el-button type="primary" @click="handleConfirm"> 确认修改 </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import articleService from "@/api/articleService";

const props = defineProps({
  modelValue: Boolean,
  articles: Object,
});

const emit = defineEmits(["close"]);

const visiable = ref(props.modelValue);
const markdownRef = ref(null);

const handleColse = () => {
  emit("close");
  visiable.value = false;
};

const handleConfirm = async () => {
  const { id, title } = props.articles;
  try {
    const res = await articleService.updateArticle(id, { title, content: markdownRef.value.getMarkdownContent() });
    console.log("res::: ", res);
  } catch (err) {
    ElMessage.error("文章更新失败", err.message);
  }
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      visiable.value = newVal;
    }
  },
);
</script>
