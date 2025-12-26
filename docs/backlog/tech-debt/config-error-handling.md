# Tech Debt: Config Error Handling Improvements

**Created:** 2025-12-26
**Source:** Task 015 code review
**Priority:** LOW

## Issues

### 1. formatMessage Silent Placeholder Handling

**File:** `src/config/messages.ts:106-108`

**Current behavior:**
```typescript
return value !== undefined ? String(value) : match;
```

If a non-existent key is passed, the function silently returns the original placeholder `{key}` instead of throwing an error.

**Risk:** Typos in placeholder names go undetected until runtime visual inspection.

**Proposed fix:** Add optional strict mode or development-time validation.

---

### 2. Redis URL Parsing Error Handling

**File:** `src/config/redis.ts`

**Issue:** Redis URL parsing lacks proper error handling for malformed URLs.

**Risk:** Cryptic errors on misconfiguration.

**Proposed fix:** Wrap URL parsing in try-catch with descriptive error message.

---

### 3. Redis Port Validation

**File:** `src/config/redis.ts`

**Issue:** Port extracted from URL is not validated (could be NaN or out of range).

**Risk:** Silent connection failures or unexpected behavior.

**Proposed fix:** Add port range validation (1-65535).

---

## Notes

- Issues #2 and #3 are in existing code, not introduced by task 015
- Issue #1 is intentional design for flexibility, but strict mode could be useful
