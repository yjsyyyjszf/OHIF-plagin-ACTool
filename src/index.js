import csTools from "cornerstone-tools";
const BaseTool = csTools.importInternal("base/BaseTool");

export default class ACTool extends BaseTool {
  constructor(name = "ACTool") {
    super({
      name,
      supportedInteractionTypes: ["Mouse"]
    });
  }

  preMouseDownCallback(evt) {
    alert("Hello cornerstoneTools!");
  }

  activeCallback(element) {
    console.log(`Hello world plugin activated`);
  }

  disabledCallback(element) {
    console.log(`Hello world plugin deactivated`);
  }
}
