import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button, buttonVariants } from "@/components/ui/button";

describe("Button", () => {
  it("default variant に bg-primary クラスが含まれる", () => {
    const cls = buttonVariants({ variant: "default" });
    expect(cls).toContain("bg-primary");
  });

  it("default variant に text-primary-foreground クラスが含まれる", () => {
    const cls = buttonVariants({ variant: "default" });
    expect(cls).toContain("text-primary-foreground");
  });

  it("outline variant に bg-background クラスが含まれる", () => {
    const cls = buttonVariants({ variant: "outline" });
    expect(cls).toContain("bg-background");
  });

  it("outline variant に border-border クラスが含まれる", () => {
    const cls = buttonVariants({ variant: "outline" });
    expect(cls).toContain("border-border");
  });

  it("DOM にボタン要素としてレンダリングされる", () => {
    const { getByRole } = render(<Button>テスト</Button>);
    expect(getByRole("button")).toBeDefined();
  });

  it("className prop を追加できる", () => {
    const { getByRole } = render(<Button className="w-full">送信</Button>);
    expect(getByRole("button").className).toContain("w-full");
  });

  it("disabled 時に pointer-events-none クラスが含まれる", () => {
    const cls = buttonVariants({});
    expect(cls).toContain("disabled:pointer-events-none");
  });

  it("sm サイズの場合 h-7 クラスが含まれる", () => {
    const cls = buttonVariants({ size: "sm" });
    expect(cls).toContain("h-7");
  });

  it("lg サイズの場合 h-9 クラスが含まれる", () => {
    const cls = buttonVariants({ size: "lg" });
    expect(cls).toContain("h-9");
  });
});
