import preview from "./modes/preview";
import edit from "./modes/edit";
export default function useOptions(props: any) {
  const options = props.mode === "preview" ? preview(props) : edit;

  return {
    options,
  };
}
