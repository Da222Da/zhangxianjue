<template>
  <el-card style="max-width: 480px">
    <template #header>
      <div class="card-header">
        <span>@wyt/spreadsheet 电子表格组件</span>
      </div>
    </template>
    <div>
      <el-link href="/preview">Preview 预览模式</el-link>
    </div>

    <template #footer>
      <el-link type="primary" href="https://github.com/Tencent/cherry-markdown/wiki/hello-world" target="_blank"> cherry-markdown </el-link>
      <el-link type="primary" href="https://mermaid.js.org/" target="_blank"> mermaid 图表 </el-link>
    </template>
  </el-card>
</template>

<style scoped>
.el-link + .el-link {
  margin-left: 10px;
}
</style>
