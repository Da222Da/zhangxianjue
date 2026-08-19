import Viewer from "viewerjs";
import preview from "./modes/preview";
import editor from "./modes/edit";
import editorOnly from "./modes/edit-only";

export default function useOptions(props: any, emit: any) {
  let options: any = {};
  switch (props.mode) {
    case "previewOnly":
      options = preview;
      break;
    case "edit&preview":
      options = editor;
      break;
    case "editOnly":
      options = editorOnly;
      break;
  }

  options.callback = {
    afterChange: (markdown: any) => {
      // 内容变化时，向父组件同步最新的 markdown
      emit("update:modelValue", markdown);
    },
    // 点击图片时，弹出图片预览
    onClickPreview: function (e: any) {
      const { target } = e;
      if (target.tagName === "IMG") {
        const tmp = new Viewer(target, {
          button: false,
          navbar: false,
          title: [1, (image: any, imageData: any) => `${image.alt.replace(/#.+$/, "")} (${imageData.naturalWidth} × ${imageData.naturalHeight})`],
          hidden() {
            tmp.destroy();
          },
        });
        tmp.show();
      }
    },
  };
  return {
    options,
  };
}
