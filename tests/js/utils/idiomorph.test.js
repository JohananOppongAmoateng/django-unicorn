import test from "ava";
import { JSDOM } from "jsdom";
import { IdiomorphMorpher } from "../../../src/django_unicorn/static/unicorn/js/morphers/idiomorph.js";
import { getEl } from "../utils.js";

// Set up JSDOM globals for idiomorph - copy ALL HTML-related globals from jsdom
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");

// Copy all HTML element types and DOM objects from jsdom window to global
Object.getOwnPropertyNames(dom.window).forEach((name) => {
  if (
    name.startsWith("HTML") ||
    name === "Document" ||
    name === "DOMParser" ||
    name === "Node" ||
    name === "Element" ||
    name === "Text" ||
    name === "Comment"
  ) {
    global[name] = dom.window[name];
  }
});
global.document = dom.window.document;

test("idiomorph contains", (t) => {
  const componentRootHtml = `
<div unicorn:id="5jypjiyb" unicorn:name="text-inputs" unicorn:checksum="GXzew3Km">
  <input unicorn:model="name" type="text" id="name"><br />
  Name: 
</div>
  `;
  const componentRoot = getEl(componentRootHtml);

  const rerenderedComponentHtml = `
<div unicorn:id="5jypjiyb" unicorn:name="text-inputs" unicorn:checksum="GXzew3Km">
  <input unicorn:model="name" type="text" id="name"><br />
  Name: Test
</div>
  `;
  const rerenderedComponent = getEl(rerenderedComponentHtml);

  const morpher = new IdiomorphMorpher({});

  t.true(componentRoot.outerHTML.indexOf("Name: Test") === -1);
  morpher.morph(componentRoot, rerenderedComponent);
  t.true(componentRoot.outerHTML.indexOf("Name: Test") > -1);
});

test("idiomorph updates attributes", (t) => {
  const componentRootHtml = `
<div unicorn:id="test">
  <div id="inner" class="old-class">
    <button id="btn" disabled>Click me</button>
  </div>
</div>
  `;
  const componentRoot = getEl(componentRootHtml);

  const rerenderedComponentHtml = `
<div unicorn:id="test">
  <div id="inner" class="new-class">
    <button id="btn">Click me</button>
  </div>
</div>
  `;
  const rerenderedComponent = getEl(rerenderedComponentHtml);

  const morpher = new IdiomorphMorpher({});

  const innerDiv = componentRoot.querySelector("#inner");
  t.true(innerDiv.className === "old-class");
  t.true(componentRoot.querySelector("#btn").hasAttribute("disabled"));

  morpher.morph(componentRoot, rerenderedComponent);

  t.true(innerDiv.className === "new-class");
  t.false(componentRoot.querySelector("#btn").hasAttribute("disabled"));
});

test("idiomorph preserves equal elements", (t) => {
  const componentRootHtml = `
<div unicorn:id="test">
  <span id="unchanged">Same content</span>
</div>
  `;
  const componentRoot = getEl(componentRootHtml);

  const rerenderedComponentHtml = `
<div unicorn:id="test">
  <span id="unchanged">Same content</span>
</div>
  `;
  const rerenderedComponent = getEl(rerenderedComponentHtml);

  const morpher = new IdiomorphMorpher({});
  morpher.morph(componentRoot, rerenderedComponent);

  // Test that morphing still works even with identical content
  t.true(componentRoot.outerHTML.indexOf("Same content") > -1);
});
