import assert from "node:assert/strict";
import test from "node:test";
import { nextTheme, normalizeTheme, readStoredTheme, storeTheme, themeStorageKey } from "./theme";

test("normalizes unknown stored values to the classic theme", () => {
  assert.equal(normalizeTheme("island"), "island");
  assert.equal(normalizeTheme("classic"), "classic");
  assert.equal(normalizeTheme("future-theme"), "classic");
  assert.equal(normalizeTheme(null), "classic");
});

test("reads and writes the selected theme through the stable storage key", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };

  assert.equal(readStoredTheme(storage), "classic");
  storeTheme(storage, "island");
  assert.equal(values.get(themeStorageKey), "island");
  assert.equal(readStoredTheme(storage), "island");
});

test("falls back safely when browser storage is unavailable", () => {
  assert.equal(
    readStoredTheme({
      getItem() {
        throw new Error("blocked");
      },
    }),
    "classic",
  );

  assert.doesNotThrow(() =>
    storeTheme(
      {
        setItem() {
          throw new Error("blocked");
        },
      },
      "island",
    ),
  );
});

test("toggles between the two supported themes", () => {
  assert.equal(nextTheme("classic"), "island");
  assert.equal(nextTheme("island"), "classic");
});
