import nanomorph from "nanomorph";

export class NanomorphMorpher {
  constructor(options) {
    this.options = options;
  }

  morph(dom, htmlElement) {
    const reloadScriptElements = this.options.RELOAD_SCRIPT_ELEMENTS || false;

    // Special handling for script elements to ensure they execute
    if (
      reloadScriptElements &&
      dom.nodeName === "SCRIPT" &&
      htmlElement.nodeName === "SCRIPT"
    ) {
      const script = document.createElement("script");
      [...htmlElement.attributes].forEach((attr) => {
        script.setAttribute(attr.nodeName, attr.nodeValue);
      });

      script.innerHTML = htmlElement.innerHTML;
      dom.replaceWith(script);
      return script;
    }

    return nanomorph(dom, htmlElement);
  }
}
