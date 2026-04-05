import { describe, it, expect } from "bun:test";
import { parseReply, isCorrectAnswer } from "./evaluate";

describe("parseReply", () => {
  describe("rfi scenario", () => {
    it("parses O as open", () => {
      const result = parseReply({ reply: "O", scenario: "rfi" });
      expect(result).toEqual({ ok: true, action: "open" });
    });

    it("parses F as fold", () => {
      const result = parseReply({ reply: "F", scenario: "rfi" });
      expect(result).toEqual({ ok: true, action: "fold" });
    });

    it("is case-insensitive", () => {
      const result = parseReply({ reply: "o", scenario: "rfi" });
      expect(result).toEqual({ ok: true, action: "open" });
    });

    it("trims whitespace", () => {
      const result = parseReply({ reply: "  F  ", scenario: "rfi" });
      expect(result).toEqual({ ok: true, action: "fold" });
    });

    it("uses only the first character", () => {
      const result = parseReply({ reply: "fold", scenario: "rfi" });
      expect(result).toEqual({ ok: true, action: "fold" });
    });

    it("rejects invalid codes with a hint", () => {
      const result = parseReply({ reply: "C", scenario: "rfi" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.hint).toContain("O (open)");
    });
  });

  describe("vs_rfi scenario", () => {
    it("parses C as call", () => {
      expect(parseReply({ reply: "C", scenario: "vs_rfi" })).toEqual({ ok: true, action: "call" });
    });

    it("parses 3 as 3bet", () => {
      expect(parseReply({ reply: "3", scenario: "vs_rfi" })).toEqual({ ok: true, action: "3bet" });
    });

    it("parses F as fold", () => {
      expect(parseReply({ reply: "F", scenario: "vs_rfi" })).toEqual({ ok: true, action: "fold" });
    });

    it("rejects O (rfi-only code) with a hint", () => {
      const result = parseReply({ reply: "O", scenario: "vs_rfi" });
      expect(result.ok).toBe(false);
    });
  });

  describe("vs_3bet scenario", () => {
    it("parses C as call", () => {
      expect(parseReply({ reply: "C", scenario: "vs_3bet" })).toEqual({ ok: true, action: "call" });
    });

    it("parses 4 as 4bet", () => {
      expect(parseReply({ reply: "4", scenario: "vs_3bet" })).toEqual({ ok: true, action: "4bet" });
    });

    it("parses F as fold", () => {
      expect(parseReply({ reply: "F", scenario: "vs_3bet" })).toEqual({ ok: true, action: "fold" });
    });

    it("rejects 3 (vs_rfi code) with a hint", () => {
      const result = parseReply({ reply: "3", scenario: "vs_3bet" });
      expect(result.ok).toBe(false);
    });
  });
});

describe("isCorrectAnswer", () => {
  it("returns true when actions match", () => {
    expect(isCorrectAnswer({ parsedAction: "open", correctAction: "open" })).toBe(true);
  });

  it("returns false when actions differ", () => {
    expect(isCorrectAnswer({ parsedAction: "fold", correctAction: "open" })).toBe(false);
  });
});
