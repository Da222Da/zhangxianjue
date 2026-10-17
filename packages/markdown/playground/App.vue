<!-- playground/App.vue -->
<template>
  <div class="playground">
    <header class="playground__header">
      <div>
        <h1>@zhangxianjue/markdown</h1>
        <p>源码编辑 + 实时预览 · 工具栏 / 扩展语法 / 目录 / 公式 / B 站播放器</p>
      </div>
      <div class="playground__actions">
        <div class="playground__modes">
          <button
            v-for="item in modes"
            :key="item.value"
            type="button"
            :class="{ 'is-active': mode === item.value }"
            @click="mode = item.value"
          >
            {{ item.label }}
          </button>
        </div>
        <button type="button" class="playground__reset" @click="content = SAMPLE_MARKDOWN">重置示例</button>
      </div>
    </header>

    <main class="playground__body">
      <Markdown
        v-model="content"
        :mode="mode"
        :file-upload="uploadImage"
        height="calc(100vh - 132px)"
        placeholder="在这里写 Markdown…"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Markdown from "../src/components/Markdown.vue";
import "../src/styles/index.css";
import { SAMPLE_MARKDOWN } from "./sample";
import type { MarkdownMode } from "../src/types";

const modes: Array<{ label: string; value: MarkdownMode }> = [
  { label: "编辑 + 预览", value: "edit&preview" },
  { label: "纯编辑", value: "editOnly" },
  { label: "纯渲染", value: "previewOnly" },
];

const mode = ref<MarkdownMode>("edit&preview");
const content = ref(SAMPLE_MARKDOWN);

/** playground 直接转 base64；真实项目应注入上传接口 */
const uploadImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
</script>

<style scoped>
.playground {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 16px 20px;
  gap: 14px;
}

.playground__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.playground__header h1 {
  font-size: 20px;
  color: #2f3542;
}

.playground__header p {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.playground__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.playground__modes {
  display: inline-flex;
  padding: 3px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.playground__modes button,
.playground__reset {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  font-size: 13px;
}

.playground__modes button.is-active {
  background: #4c72b0;
  color: #fff;
}

.playground__reset {
  border: 1px solid #e5e7eb;
  background: #fff;
}

.playground__body {
  flex: 1;
  min-height: 0;
}
</style>
