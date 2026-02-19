import { MorphdomMorpher } from "./morphers/morphdom.js";
import { AlpineMorpher } from "./morphers/alpine.js";
import { IdiomorphMorpher } from "./morphers/idiomorph.js";
import { NanomorphMorpher } from "./morphers/nanomorph.js";
import { isEmpty } from "./utils.js";

const MORPHER_CLASSES = {
  morphdom: MorphdomMorpher,
  alpine: AlpineMorpher,
  idiomorph: IdiomorphMorpher,
  nanomorph: NanomorphMorpher,
};

export function getMorpher(morpherSettings) {
  const morpherName = morpherSettings.NAME;

  if (isEmpty(morpherName)) {
    throw Error(" Missing morpher name");
  }

  const MorpherClass = MORPHER_CLASSES[morpherName];

  if (MorpherClass) {
    return new MorpherClass(morpherSettings);
  }

  throw Error(`Unknown morpher: ${morpherName}`);
}
