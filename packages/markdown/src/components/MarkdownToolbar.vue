<!-- src/components/MarkdownToolbar.vue -->
<template>
  <div ref="rootRef" class="md-toolbar" role="toolbar" aria-label="Markdown 工具栏">
    <template v-for="(item, index) in items" :key="`${item}-${index}`">
      <span v-if="item === '|'" class="md-toolbar__separator" aria-hidden="true" />

      <div v-else class="md-toolbar__group">
        <button
          type="button"
          class="md-toolbar__button"
          :class="{ 'is-open': openMenu === item }"
          :title="meta(item).title"
          :aria-label="meta(item).title"
          :aria-expanded="hasSubmenu(item) ? openMenu === item : undefined"
          :disabled="isDisabled(item)"
          @click="handleClick(item)"
        >
          <span class="md-toolbar__label" :class="`md-toolbar__label--${item}`">{{ meta(item).label }}</span>
          <span v-if="hasSubmenu(item)" class="md-toolbar__caret" aria-hidden="true">▾</span>
        </button>

        <div v-if="openMenu === item && hasSubmenu(item)" class="md-toolbar__menu">
          <template v-if="item === 'size'">
            <button
              v-for="option in SIZE_OPTIONS"
              :key="option.value"
              type="button"
              class="md-toolbar__menu-item"
              @click="chooseSize(option.value)"
            >
              {{ option.label }}
            </button>
          </template>

          <template v-else-if="item === 'header'">
            <button
              v-for="option in HEADER_OPTIONS"
              :key="option.value"
              type="button"
              class="md-toolbar__menu-item"
              @click="chooseHeader(option.value)"
            >
              {{ option.label }}
            </button>
          </template>

          <template v-else-if="item === 'list'">
            <button
              v-for="option in LIST_OPTIONS"
              :key="option.value"
              type="button"
              class="md-toolbar__menu-item"
              @click="chooseList(option.value)"
            >
              {{ option.label }}
            </button>
          </template>

          <template v-else-if="item === 'justify'">
            <button
              v-for="option in ALIGN_OPTIONS"
              :key="option.value"
              type="button"
              class="md-toolbar__menu-item"
              @click="chooseAlign(option.value)"
            >
              {{ option.label }}
            </button>
          </template>

          <template v-else-if="item === 'panel'">
            <button
              v-for="option in PANEL_OPTIONS"
              :key="option.value"
              type="button"
              class="md-toolbar__menu-item"
              @click="choosePanel(option.value)"
            >
              {{ option.label }}
            </button>
          </template>

          <template v-else-if="item === 'color'">
            <div class="md-toolbar__color-block">
              <div class="md-toolbar__color-row">
                <span class="md-toolbar__color-label">文字颜色</span>
                <input
                  class="md-toolbar__color-input"
                  type="color"
                  :value="fontColor"
                  aria-label="文字颜色"
                  @input="onColorInput($event, false)"
                  @change="chooseColor(fontColor, false)"
                />
              </div>
              <div class="md-toolbar__swatches">
                <button
                  v-for="color in COLOR_PRESETS"
                  :key="`font-${color}`"
                  type="button"
                  class="md-toolbar__swatch"
                  :style="{ background: color }"
                  :title="`文字颜色 ${color}`"
                  @click="chooseColor(color, false)"
                />
              </div>
            </div>

            <div class="md-toolbar__color-block">
              <div class="md-toolbar__color-row">
                <span class="md-toolbar__color-label">背景色</span>
                <input
                  class="md-toolbar__color-input"
                  type="color"
                  :value="backgroundColor"
                  aria-label="文字背景色"
                  @input="onColorInput($event, true)"
                  @change="chooseColor(backgroundColor, true)"
                />
              </div>
              <div class="md-toolbar__swatches">
                <button
                  v-for="color in COLOR_PRESETS"
                  :key="`bg-${color}`"
                  type="button"
                  class="md-toolbar__swatch"
                  :style="{ background: color }"
                  :title="`背景色 ${color}`"
                  @click="chooseColor(color, true)"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
  ALIGN_OPTIONS,
  COLOR_PRESETS,
  DEFAULT_TOOLBAR,
  HEADER_OPTIONS,
  LIST_OPTIONS,
  PANEL_OPTIONS,
  SIZE_OPTIONS,
  SUBMENU_ITEMS,
  TOOLBAR_META,
} from "../core/toolbar";
import type { AlignType, PanelType, ToolbarCommand, ToolbarItem } from "../types";

const props = withDefaults(
  defineProps<{
    items?: ToolbarItem[];
    canUndo?: boolean;
    canRedo?: boolean;
    disabled?: boolean;
  }>(),
  {
    items: () => DEFAULT_TOOLBAR,
    canUndo: true,
    canRedo: true,
    disabled: false,
  },
);

const emit = defineEmits<{
  command: [command: ToolbarCommand];
}>();

const rootRef = ref<HTMLDivElement | null>(null);
const openMenu = ref<ToolbarItem | null>(null);
const fontColor = ref("#e74c3c");
const backgroundColor = ref("#f1c40f");

const meta = (item: ToolbarItem): { label: string; title: string } =>
  TOOLBAR_META[item as Exclude<ToolbarItem, "|">];

const hasSubmenu = (item: ToolbarItem): boolean => SUBMENU_ITEMS.has(item);

const isDisabled = (item: ToolbarItem): boolean => {
  if (props.disabled) {
    return true;
  }
  if (item === "undo") {
    return !props.canUndo;
  }
  if (item === "redo") {
    return !props.canRedo;
  }
  return false;
};

const close = (): void => {
  openMenu.value = null;
};

const emitSimple = (item: ToolbarItem): void => {
  emit("command", { name: item } as ToolbarCommand);
  close();
};

const handleClick = (item: ToolbarItem): void => {
  if (props.disabled) {
    return;
  }
  if (!hasSubmenu(item)) {
    emitSimple(item);
    return;
  }
  openMenu.value = openMenu.value === item ? null : item;
};

const chooseSize = (size: number): void => {
  emit("command", { name: "size", size });
  close();
};

const chooseHeader = (level: number): void => {
  emit("command", { name: "header", level });
  close();
};

const chooseList = (kind: "ul" | "ol" | "checklist"): void => {
  emit("command", { name: "list", kind });
  close();
};

const chooseAlign = (align: AlignType): void => {
  emit("command", { name: "align", align });
  close();
};

const choosePanel = (type: PanelType): void => {
  emit("command", { name: "panel", type });
  close();
};

const chooseColor = (color: string, background: boolean): void => {
  emit("command", { name: "color", color, background });
  close();
};

const onColorInput = (event: Event, background: boolean): void => {
  const value = (event.target as HTMLInputElement).value;
  if (background) {
    backgroundColor.value = value;
  } else {
    fontColor.value = value;
  }
};

const onPointerDown = (event: PointerEvent): void => {
  if (!openMenu.value) {
    return;
  }
  const root = rootRef.value;
  if (root && !root.contains(event.target as Node)) {
    close();
  }
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape") {
    close();
  }
};

onMounted(() => {
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onPointerDown);
  document.removeEventListener("keydown", onKeydown);
});
</script>
