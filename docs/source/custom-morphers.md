# Custom Morphers

The morpher is a library used to update specific parts of the DOM element instead of replacing the entire element. This improves performance and maintains the state of unchanged DOM elements, such as the cursor position in an input.

The default morpher used in Unicorn is [`morphdom`](https://github.com/patrick-steele-idem/morphdom). Alternative morphers available include the [Alpine.js morph plugin](https://alpinejs.dev/plugins/morph), [Idiomorph](https://github.com/bigskysoftware/idiomorph), and [Nanomorph](https://github.com/choojs/nanomorph).

## `Morphdom` (Default)

`morphdom` is the default morpher so no extra settings or installation is required to use it.

## `Alpine`

Components which use both `Unicorn` and `Alpine.js` should use the `Alpine.js` morpher to prevent losing state when it gets re-rendered.

## `Idiomorph`

`Idiomorph` is a modern DOM morphing library created by the htmx team. It provides an alternative morphing strategy that can be beneficial for certain use cases, particularly when working with complex DOM structures.

## `Nanomorph`

`Nanomorph` is a lightweight and fast DOM morphing library. It's particularly useful for performance-sensitive applications and includes special handling for script elements when configured appropriately.

## Django Settings

### Morphdom (Default)

No configuration needed. `morphdom` is used by default.

### Alpine

```python
# settings.py

UNICORN = {
    ...
    "MORPHER": {
        "NAME": "alpine",
    }
    ...
}
```

```{note}
`MORPHER.RELOAD_SCRIPT_ELEMENTS` is not currently supported for the `Alpine.js` morpher.
```

### Idiomorph

```python
# settings.py

UNICORN = {
    ...
    "MORPHER": {
        "NAME": "idiomorph",
    }
    ...
}
```

### Nanomorph

```python
# settings.py

UNICORN = {
    ...
    "MORPHER": {
        "NAME": "nanomorph",
        "RELOAD_SCRIPT_ELEMENTS": True,  # Optional: Enable special script element handling
    }
    ...
}
```

```{note}
The `RELOAD_SCRIPT_ELEMENTS` option is supported by `morphdom` and `nanomorph` morphers. When enabled, script elements will be properly reloaded when they are updated.
```

### JavaScript Installation

#### Alpine.js

`Alpine.js` is not included in `Unicorn` so you will need to manually include it. Make sure to include `Alpine.js` and the morpher plugin by adding the following line to your template before `{% unicorn_scripts %}`.

```html
...
<head>
  <script defer src="https://unpkg.com/@alpinejs/morph@3.x.x/dist/cdn.min.js"></script>
  <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
  {% unicorn_scripts %}
</head>
...
```

#### Idiomorph and Nanomorph

`Idiomorph` and `Nanomorph` are bundled with `Unicorn` starting from version X.X.X, so no additional JavaScript installation is required. Simply configure the morpher in your Django settings and the appropriate JavaScript will be loaded automatically.

## Choosing a Morpher

Different morphing libraries have different characteristics:

- **Morphdom** (Default): Well-tested, reliable, and works for most use cases. Good balance of features and performance.
- **Alpine**: Best choice when using Alpine.js components alongside Unicorn components to maintain Alpine state.
- **Idiomorph**: Modern morphing library with sophisticated algorithms for complex DOM structures. May provide better results in certain edge cases.
- **Nanomorph**: Lightweight and fast. Good choice for performance-sensitive applications with simpler DOM structures.

For most applications, the default `morphdom` morpher is recommended unless you have specific requirements that benefit from one of the alternative morphers.
