# Security Audit Report — django-unicorn

**Package version audited:** 0.65.2  
**Date:** 2026-02-21  
**Scope:** Source code (`src/django_unicorn/`) and declared runtime dependencies  

---

## Executive Summary

The audit identified **five security issues in the source code** and **two categories of CVE-affected dependency ranges**. All source-code issues are exploitable only through the existing AJAX message endpoint; none require physical access or prior code execution. The most actionable fixes are a one-line change for the timing attack and a one-line change for the HMAC truncation.

| ID | Title | Severity | Location |
|----|-------|----------|----------|
| SC-01 | Timing attack in checksum comparison | **High** | `views/request.py:105` |
| SC-02 | HMAC output truncated to 45 bits | **Medium** | `utils.py:59` |
| SC-03 | Open redirect injected into `<script>` without validation | **Medium** | `components/unicorn_view.py:428` |
| SC-04 | `pickle.loads()` on cache data | **Low** | `components/unicorn_view.py:319` |
| SC-05 | `mark_safe()` on user-controlled field values | **Low** | `components/unicorn_view.py:299` |
| DEP-01 | Vulnerable `django` lower bound (`>=2.2`) | **High** | `pyproject.toml` |
| DEP-02 | Vulnerable `orjson` lower bound (`>=3.6.0`) | **Medium** | `pyproject.toml` |

---

## Source-Code Findings

---

### SC-01 — Timing Attack in Checksum Comparison

**Severity:** High  
**CWE:** CWE-208 (Information Exposure Through Timing Discrepancy)  
**File:** `src/django_unicorn/views/request.py`, line 105

#### Description

Every AJAX request carries a client-submitted `checksum` that is compared against an HMAC-SHA256 value derived from `SECRET_KEY`. The comparison uses Python's built-in `!=` operator:

```python
# views/request.py – validate_checksum()
generated_checksum = generate_checksum(self.data)

if checksum != generated_checksum:          # <-- non-constant-time
    raise AssertionError("Checksum does not match")
```

Python's string equality short-circuits as soon as it finds the first differing character. An attacker who can make many requests and measure response times can leak the expected checksum one character at a time, allowing checksum forgery without knowing `SECRET_KEY`.

#### Recommendation

Replace with a constant-time comparison:

```python
import hmac

if not hmac.compare_digest(checksum, generated_checksum):
    raise AssertionError("Checksum does not match")
```

`hmac.compare_digest` is part of the Python standard library and is explicitly designed for this use-case.

---

### SC-02 — HMAC Output Truncated to ~45 Bits

**Severity:** Medium  
**CWE:** CWE-916 (Use of Password Hash With Insufficient Computational Effort)  
**File:** `src/django_unicorn/utils.py`, lines 54–59

#### Description

`generate_checksum()` computes an HMAC-SHA256 of the component data, producing 256 bits of output. That output is then passed through `shortuuid.uuid()` and sliced to 8 characters:

```python
# utils.py – generate_checksum()
checksum = hmac.new(
    str.encode(settings.SECRET_KEY),
    data_bytes,
    digestmod="sha256",
).hexdigest()                         # 256 bits
checksum = shortuuid.uuid(checksum)[:8]   # ~45 bits
```

The `shortuuid` alphabet has 57 characters, so 8 characters = log₂(57⁸) ≈ **45.6 bits**. This reduces the collision resistance from 128 bits (birthday) to 22 bits — roughly 4 million requests suffice to find a collision through blind probing, making data-tampering forgeries significantly more practical, especially if `SECRET_KEY` is ever leaked.

#### Recommendation

Return the full 64-character hexdigest. This is a one-line change:

```python
# Remove the shortuuid line entirely:
return hmac.new(
    str.encode(settings.SECRET_KEY),
    data_bytes,
    digestmod="sha256",
).hexdigest()
```

> **Note:** This is a breaking change for deployed applications — clients hold the old 8-character checksum in the page. A rolling deployment or a versioned checksum format is required.

---

### SC-03 — Open Redirect URL Injected into `<script>` Without Validation

**Severity:** Medium  
**CWE:** CWE-601 (URL Redirection to Untrusted Site), CWE-79 (XSS)  
**File:** `src/django_unicorn/components/unicorn_view.py`, line 428

#### Description

When a component's `mount()` method returns an `HttpResponseRedirect`, the redirect URL is injected directly into a `<script>` tag in the rendered HTML:

```python
# unicorn_view.py – render()
if isinstance(self._mount_result, HttpResponseRedirect):
    return f"<script>window.location.href = '{self._mount_result.url}';</script>"
```

If the URL contains a single quote, or if its value is attacker-influenced (e.g. sourced from a query parameter without sanitisation in the view), this is both a **reflected XSS** vector and an **open redirect**. For example, a URL of `'; alert(1); //` would produce:

```html
<script>window.location.href = ''; alert(1); //';</script>
```

#### Recommendation

1. Use `json.dumps` to safely encode the URL into the JavaScript string literal:

```python
import json

if isinstance(self._mount_result, HttpResponseRedirect):
    safe_url = json.dumps(self._mount_result.url)   # properly quoted + escaped
    return f"<script>window.location.href = {safe_url};</script>"
```

2. Validate that the URL is a safe relative or whitelisted absolute URL before using it (Django's `url_has_allowed_host_and_scheme` utility is purpose-built for this).

---

### SC-04 — `pickle.loads()` on In-Process Cache Data

**Severity:** Low (conditional)  
**CWE:** CWE-502 (Deserialization of Untrusted Data)  
**File:** `src/django_unicorn/components/unicorn_view.py`, line 319

#### Description

The `reset()` method restores component attributes from a dict called `_resettable_attributes_cache`, where values are stored as pickled bytes. This dict is populated on the same server process by `_set_resettable_attributes_cache()`:

```python
# unicorn_view.py – reset()
attribute_value = pickle.loads(pickled_value)   # noqa: S301
```

Under the default (in-memory) cache, the pickled data never leaves the process and the risk is low. However, if the application is configured to use a **shared external cache** (Redis, Memcached) that is network-accessible or shared across tenants, an attacker who can write to the cache can inject a malicious pickled payload and achieve **arbitrary code execution** when any component calls `$reset`.

#### Recommendation

- Replace `pickle` with a safer serialisation format such as `json` or `dataclasses.asdict` + re-construction. `UnicornField` and unpersisted Django model instances are the only types stored here.
- If `pickle` must be kept for performance reasons, document clearly that the configured cache **must** be trusted and isolated, and add a runtime warning when an external cache backend is detected.
- At minimum, add a `__reduce__` guard or HMAC-sign the pickled bytes before storing them.

---

### SC-05 — `mark_safe()` Applied to User-Controlled Field Values

**Severity:** Low (requires developer misconfiguration)  
**CWE:** CWE-79 (Cross-Site Scripting)  
**File:** `src/django_unicorn/components/unicorn_view.py`, line 299

#### Description

Fields listed in `Meta.safe` have `mark_safe()` applied to their values after every request cycle:

```python
# unicorn_view.py – _handle_safe_fields()
for field_name in safe_fields:
    value = getattr(self, field_name)
    if isinstance(value, str):
        setattr(self, field_name, mark_safe(value))   # noqa: S308
```

`mark_safe()` permanently disables Django's HTML auto-escaping on the returned string. If a developer inadvertently adds a field to `Meta.safe` whose value is populated from user input (e.g. `unicorn:model` bindings), that input will render as raw HTML in the template, enabling **stored XSS**.

#### Recommendation

- Document prominently (and in-code via a docstring/comment) that `Meta.safe` must **never** be used for fields whose values come from user input.
- Consider emitting a `warnings.warn` at component initialisation time when a `Meta.safe` field is also bound via `unicorn:model` in the template, to alert developers at development time.

---

## Dependency CVEs

The currently **installed** versions (as pinned in this environment) have no known CVEs:

| Package | Installed | Status |
|---------|-----------|--------|
| Django | 6.0.2 | ✅ No CVEs |
| lxml | 6.0.2 | ✅ No CVEs |
| orjson | 3.11.7 | ✅ No CVEs |
| shortuuid | 1.0.13 | ✅ No CVEs |
| cachetools | 7.0.1 | ✅ No CVEs |
| decorator | 5.2.1 | ✅ No CVEs |

However, `pyproject.toml` specifies very loose lower bounds, meaning **any consumer of this package may install vulnerable versions**:

---

### DEP-01 — Vulnerable Django Versions Permitted by Lower Bound

**Severity:** High  
**Declared minimum:** `django>=2.2`

Any user running a Django version below the patched releases listed below is exposed to the following CVEs:

| CVE / Advisory | Affected Range | Patched In | Type |
|----------------|----------------|------------|------|
| SQL injection via `_connector` kwarg in `QuerySet`/`Q` | `<4.2.26`, `>=5.0a1,<5.1.14`, `>=5.2a1,<5.2.8` | 4.2.26 / 5.1.14 / 5.2.8 | SQL Injection |
| SQL injection in column aliases | `>=4.2,<4.2.25`, `>=5.1,<5.1.13`, `>=5.2,<5.2.7` | 4.2.25 / 5.1.13 / 5.2.7 | SQL Injection |
| SQL injection in `HasKey(lhs, rhs)` on Oracle | `>=4.2,<4.2.17`, `>=5.0,<5.0.10`, `>=5.1,<5.1.4` | 4.2.17 / 5.0.10 / 5.1.4 | SQL Injection (Oracle only) |
| DoS in `HttpResponseRedirect` / `HttpResponsePermanentRedirect` (Windows) | `<4.2.26`, `>=5.0a1,<5.1.14`, `>=5.2a1,<5.2.8` | 4.2.26 / 5.1.14 / 5.2.8 | Denial of Service (Windows) |
| DoS in `intcomma` template filter | `>=3.2,<3.2.24`, `>=4.2,<4.2.10`, `>=5.0,<5.0.2` | 3.2.24 / 4.2.10 / 5.0.2 | Denial of Service |

**Recommendation:** Tighten the lower bound to the oldest still-patched Django release, currently `>=4.2.26`, and add a note to the changelog explaining the reasoning. The Django 2.x and 3.x branches have been end-of-life since April 2022 and April 2024 respectively.

```toml
# pyproject.toml
dependencies = [
    "django>=4.2.26",   # 4.2 LTS; oldest release with no active CVEs
    ...
]
```

---

### DEP-02 — Vulnerable orjson Versions Permitted by Lower Bound

**Severity:** Medium  
**Declared minimum:** `orjson>=3.6.0`

| Advisory | Affected Range | Patched In | Type |
|----------|----------------|------------|------|
| Recursion DoS on deeply nested JSON | `<3.9.15` | 3.9.15 | Denial of Service |

orjson is used to parse the incoming AJAX request body in `message.py` via `loads(request.body)`. A malicious client can craft a deeply nested JSON payload to trigger a stack overflow, crashing the worker process.

**Recommendation:** Raise the minimum bound:

```toml
"orjson>=3.9.15",
```

---

## Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| 🔴 Immediate | DEP-01 — Tighten Django lower bound | Low (1-line `pyproject.toml` change) |
| 🔴 Immediate | SC-01 — Use `hmac.compare_digest()` | Low (1-line change) |
| 🟠 Short-term | DEP-02 — Tighten orjson lower bound | Low (1-line change) |
| 🟠 Short-term | SC-02 — Remove HMAC truncation | Low (1-line change, breaking) |
| 🟠 Short-term | SC-03 — Sanitise redirect URL in `<script>` | Low (2-line change) |
| 🟡 Medium-term | SC-04 — Replace `pickle` with JSON serialisation | Medium |
| 🟡 Medium-term | SC-05 — Warn when `Meta.safe` meets user-bound field | Medium |

---

*Report produced by automated static analysis and advisory database lookup against version 0.65.2. Findings should be verified by a qualified security engineer before public disclosure.*
