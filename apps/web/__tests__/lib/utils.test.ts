import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("単一クラスをそのまま返す", () => {
    expect(cn("text-sm")).toBe("text-sm");
  });

  it("複数クラスをスペース区切りで結合する", () => {
    expect(cn("text-sm", "font-bold")).toBe("text-sm font-bold");
  });

  it("falsy値を無視する", () => {
    expect(cn("text-sm", false, null, undefined, "font-bold")).toBe(
      "text-sm font-bold"
    );
  });

  it("条件付きクラスを処理する", () => {
    const active = true;
    const disabled = false;
    expect(cn("base", active && "active", disabled && "disabled")).toBe(
      "base active"
    );
  });

  it("Tailwind の競合クラスを後勝ちでマージする", () => {
    expect(cn("text-sm text-lg")).toBe("text-lg");
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("引数なしで空文字を返す", () => {
    expect(cn()).toBe("");
  });
});
