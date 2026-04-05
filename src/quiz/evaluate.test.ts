import * as bunTest from "bun:test";
import * as evaluate from "./evaluate";

bunTest.describe("parseReply", () => {
  bunTest.describe("rfi scenario", () => {
    bunTest.it("parses O as open", () => {
      const result = evaluate.parseReply({ reply: "O", scenario: "rfi" });
      bunTest.expect(result).toEqual({ ok: true, action: "open" });
    });

    bunTest.it("parses F as fold", () => {
      const result = evaluate.parseReply({ reply: "F", scenario: "rfi" });
      bunTest.expect(result).toEqual({ ok: true, action: "fold" });
    });

    bunTest.it("is case-insensitive", () => {
      const result = evaluate.parseReply({ reply: "o", scenario: "rfi" });
      bunTest.expect(result).toEqual({ ok: true, action: "open" });
    });

    bunTest.it("trims whitespace", () => {
      const result = evaluate.parseReply({ reply: "  F  ", scenario: "rfi" });
      bunTest.expect(result).toEqual({ ok: true, action: "fold" });
    });

    bunTest.it("uses only the first character", () => {
      const result = evaluate.parseReply({ reply: "fold", scenario: "rfi" });
      bunTest.expect(result).toEqual({ ok: true, action: "fold" });
    });

    bunTest.it("rejects invalid codes with a hint", () => {
      const result = evaluate.parseReply({ reply: "C", scenario: "rfi" });
      bunTest.expect(result.ok).toBe(false);
      if (!result.ok) bunTest.expect(result.hint).toContain("O (open)");
    });
  });

  bunTest.describe("vs_rfi scenario", () => {
    bunTest.it("parses C as call", () => {
      bunTest.expect(evaluate.parseReply({ reply: "C", scenario: "vs_rfi" })).toEqual({ ok: true, action: "call" });
    });

    bunTest.it("parses 3 as 3bet", () => {
      bunTest.expect(evaluate.parseReply({ reply: "3", scenario: "vs_rfi" })).toEqual({ ok: true, action: "3bet" });
    });

    bunTest.it("parses F as fold", () => {
      bunTest.expect(evaluate.parseReply({ reply: "F", scenario: "vs_rfi" })).toEqual({ ok: true, action: "fold" });
    });

    bunTest.it("rejects O (rfi-only code) with a hint", () => {
      const result = evaluate.parseReply({ reply: "O", scenario: "vs_rfi" });
      bunTest.expect(result.ok).toBe(false);
    });
  });

  bunTest.describe("vs_3bet scenario", () => {
    bunTest.it("parses C as call", () => {
      bunTest.expect(evaluate.parseReply({ reply: "C", scenario: "vs_3bet" })).toEqual({ ok: true, action: "call" });
    });

    bunTest.it("parses 4 as 4bet", () => {
      bunTest.expect(evaluate.parseReply({ reply: "4", scenario: "vs_3bet" })).toEqual({ ok: true, action: "4bet" });
    });

    bunTest.it("parses F as fold", () => {
      bunTest.expect(evaluate.parseReply({ reply: "F", scenario: "vs_3bet" })).toEqual({ ok: true, action: "fold" });
    });

    bunTest.it("rejects 3 (vs_rfi code) with a hint", () => {
      const result = evaluate.parseReply({ reply: "3", scenario: "vs_3bet" });
      bunTest.expect(result.ok).toBe(false);
    });
  });
});

bunTest.describe("isCorrectAnswer", () => {
  bunTest.it("returns true when actions match", () => {
    bunTest.expect(evaluate.isCorrectAnswer({ parsedAction: "open", correctAction: "open" })).toBe(true);
  });

  bunTest.it("returns false when actions differ", () => {
    bunTest.expect(evaluate.isCorrectAnswer({ parsedAction: "fold", correctAction: "open" })).toBe(false);
  });
});
