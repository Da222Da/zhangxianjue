import Viewer from "viewerjs";
import preview from "./modes/preview";
import editor from "./modes/edit";
import editorOnly from "./modes/edit-only";
import type { MarkdownEditorProps } from "../../types.js";

/** cherry 的 fileUpload 回调入参，见 cherry-markdown/types/cherry.d.ts 的 CherryFileUploadHandler */
type FileUploadCallback = (url: string, params?: { name?: string }) => void;

export default function useOptions(props: MarkdownEditorProps, emit: (event: "update:modelValue", value: string) => void) {
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

  // 宿主注入了上传实现时接管图片上传；
  // 未注入则保持 cherry 的默认行为（转 base64 内联），不做任何干预。
  const { fileUpload } = props;
  if (fileUpload) {
    options.callback.fileUpload = (file: File, callback: FileUploadCallback): void => {
      fileUpload(file)
        .then((url: string) => {
          // 回填文件名作为图片的 alt
          callback(url, { name: file.name });
        })
        .catch((error: unknown) => {
          // 提示由宿主的上传实现内部负责（本包不依赖任何 UI 库），
          // 这里只记录日志并放弃插入，避免把无效图片写进正文。
          console.error("[markdown-editor] 图片上传失败，已放弃插入", error);
        });
    };
  }

  return {
    options,
  };
}
