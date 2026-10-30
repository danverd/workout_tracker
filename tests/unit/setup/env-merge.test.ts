// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hasKey, mergeEnv } from "../../../scripts/env-merge.mjs";

const generate = {
  SESSION_SECRET: () => "s",
  IP_HASH_SECRET: () => "i",
  APP_TIME_ZONE: () => "UTC",
};

describe("mergeEnv", () => {
  it("adds only the missing keys and keeps existing lines", () => {
    const old = "APP_PASSCODE_HASH=abc:def\nAPP_TIME_ZONE=Europe/Paris\n";
    const result = mergeEnv(old, { generate });
    expect(result.added).toEqual(["SESSION_SECRET", "IP_HASH_SECRET"]);
    expect(result.text).toBe(`${old}SESSION_SECRET=s\nIP_HASH_SECRET=i\n`);
  });
  it("replaces just the passcode line when asked", () => {
    const old = "APP_PASSCODE_HASH=old\nSESSION_SECRET=x\n";
    const result = mergeEnv(old, { passcodeHash: "new", generate });
    expect(result.replaced).toEqual(["APP_PASSCODE_HASH"]);
    expect(result.text.split("\n")[0]).toBe("APP_PASSCODE_HASH=new");
    expect(result.text).toContain("SESSION_SECRET=x");
  });
  it("is a no-op when complete", () => {
    const full =
      "APP_PASSCODE_HASH=a\nSESSION_SECRET=b\nIP_HASH_SECRET=c\nAPP_TIME_ZONE=d\n";
    const result = mergeEnv(full, { generate });
    expect(result.added).toEqual([]);
    expect(result.text).toBe(full);
    expect(hasKey(full, "SESSION_SECRET")).toBe(true);
    expect(hasKey("# SESSION_SECRET=x", "SESSION_SECRET")).toBe(false);
  });

  it("handles CRLF input and writes LF", () => {
    const result = mergeEnv("APP_TIME_ZONE=UTC\r\nSESSION_SECRET=x\r\n", {
      generate,
    });
    expect(result.added).toEqual(["IP_HASH_SECRET"]);
    expect(result.text).toBe(
      "APP_TIME_ZONE=UTC\nSESSION_SECRET=x\nIP_HASH_SECRET=i\n",
    );
  });
  it("counts export-prefixed and quoted keys as present", () => {
    const old = `export SESSION_SECRET=a\nIP_HASH_SECRET="b c"\nAPP_TIME_ZONE='UTC'\n`;
    const result = mergeEnv(old, { generate });
    expect(result.added).toEqual([]);
    expect(result.text).toBe(old);
    expect(hasKey(old, "SESSION_SECRET")).toBe(true);
    expect(hasKey(old, "IP_HASH_SECRET")).toBe(true);
    expect(hasKey("export A=1\r\n", "A")).toBe(true);
  });
  it("replaces an exported or quoted passcode line", () => {
    const result = mergeEnv('# note\nexport APP_PASSCODE_HASH="old"\n', {
      passcodeHash: "new",
      generate,
    });
    expect(result.replaced).toEqual(["APP_PASSCODE_HASH"]);
    expect(result.text.split("\n").slice(0, 2)).toEqual([
      "# note",
      "APP_PASSCODE_HASH=new",
    ]);
  });
  it("adds the passcode to an empty file and never reports values", () => {
    const result = mergeEnv("", { passcodeHash: "salt:secret", generate });
    expect(result.added).toEqual([
      "APP_PASSCODE_HASH",
      "SESSION_SECRET",
      "IP_HASH_SECRET",
      "APP_TIME_ZONE",
    ]);
    expect(JSON.stringify([result.added, result.replaced])).not.toMatch(
      /secret|=/,
    );
  });
});
