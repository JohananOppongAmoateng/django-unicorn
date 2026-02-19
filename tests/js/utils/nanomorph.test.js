import test from "ava";
import { JSDOM } from "jsdom";
import { NanomorphMorpher } from "../../../src/django_unicorn/static/unicorn/js/morphers/nanomorph.js";
import { getEl } from "../utils.js";

// Set up JSDOM globals for nanomorph
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;

test("nanomorph contains", (t) => {
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

  const morpher = new NanomorphMorpher({});

  t.true(componentRoot.outerHTML.indexOf("Name: Test") === -1);
  morpher.morph(componentRoot, rerenderedComponent);
  t.true(componentRoot.outerHTML.indexOf("Name: Test") > -1);
});

test("nanomorph updates attributes", (t) => {
  const componentRootHtml = `
<div unicorn:id="test" class="old-class">
  <button id="btn" disabled>Click me</button>
</div>
  `;
  const componentRoot = getEl(componentRootHtml);

  const rerenderedComponentHtml = `
<div unicorn:id="test" class="new-class">
  <button id="btn">Click me</button>
</div>
  `;
  const rerenderedComponent = getEl(rerenderedComponentHtml);

  const morpher = new NanomorphMorpher({});

  t.true(componentRoot.className === "old-class");
  t.true(componentRoot.querySelector("#btn").hasAttribute("disabled"));

  morpher.morph(componentRoot, rerenderedComponent);

  t.true(componentRoot.className === "new-class");
  t.false(componentRoot.querySelector("#btn").hasAttribute("disabled"));
});

test("nanomorph handles script elements when RELOAD_SCRIPT_ELEMENTS is true", (t) => {
  const containerHtml = `<div id="container"><script id="test-script">console.log("old");</script></div>`;
  const container = getEl(containerHtml);
  const oldScript = container.querySelector("#test-script");

  const newContainerHtml = `<div id="container"><script id="test-script">console.log("new");</script></div>`;
  const newContainer = getEl(newContainerHtml);
  const newScript = newContainer.querySelector("#test-script");

  const morpher = new NanomorphMorpher({ RELOAD_SCRIPT_ELEMENTS: true });
  const result = morpher.morph(oldScript, newScript);

  // Verify that a new script element was created
  t.true(result.nodeName === "SCRIPT");
  t.true(result.innerHTML.indexOf("new") > -1);
  t.true(result.id === "test-script");
});

test("nanomorph handles script elements when RELOAD_SCRIPT_ELEMENTS is false", (t) => {
  const containerHtml = `<div id="container"><script id="test-script">console.log("old");</script></div>`;
  const container = getEl(containerHtml);
  const oldScript = container.querySelector("#test-script");

  const newContainerHtml = `<div id="container"><script id="test-script">console.log("new");</script></div>`;
  const newContainer = getEl(newContainerHtml);
  const newScript = newContainer.querySelector("#test-script");

  const morpher = new NanomorphMorpher({ RELOAD_SCRIPT_ELEMENTS: false });

  // When RELOAD_SCRIPT_ELEMENTS is false, it should use regular nanomorph behavior
  const result = morpher.morph(oldScript, newScript);

  t.true(result.nodeName === "SCRIPT");
});

test("nanomorph preserves non-script elements", (t) => {
  const componentRootHtml = `
<div unicorn:id="test">
  <p>Some text</p>
</div>
  `;
  const componentRoot = getEl(componentRootHtml);

  const rerenderedComponentHtml = `
<div unicorn:id="test">
  <p>Different text</p>
</div>
  `;
  const rerenderedComponent = getEl(rerenderedComponentHtml);

  const morpher = new NanomorphMorpher({ RELOAD_SCRIPT_ELEMENTS: true });
  morpher.morph(componentRoot, rerenderedComponent);

  t.true(componentRoot.outerHTML.indexOf("Different text") > -1);
  t.false(componentRoot.outerHTML.indexOf("Some text") > -1);
});
