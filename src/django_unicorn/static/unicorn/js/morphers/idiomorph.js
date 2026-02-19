import { Idiomorph } from "idiomorph/dist/idiomorph.esm.js";

export class IdiomorphMorpher {
  constructor(options) {
    this.options = options;
  }

  morph(dom, htmlElement) {
    // Convert htmlElement to HTML string for idiomorph
    const htmlString =
      typeof htmlElement === "string" ? htmlElement : htmlElement.outerHTML;

    return Idiomorph.morph(dom, htmlString, {
      morphStyle: "innerHTML",
    });
  }
}
