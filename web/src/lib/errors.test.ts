import { parseErrorDetail } from "./errors";

describe("parseErrorDetail", () => {
  it("returns a plain string detail unchanged", () => {
    expect(parseErrorDetail("Incorrect email or password")).toBe("Incorrect email or password");
  });

  it("turns a FastAPI 422 validation list into 'field: message' pairs", () => {
    const detail = [
      {
        type: "value_error",
        loc: ["body", "email"],
        msg: "value is not a valid email address",
      },
      {
        type: "string_too_short",
        loc: ["body", "password"],
        msg: "String should have at least 8 characters",
      },
    ];

    expect(parseErrorDetail(detail)).toBe(
      "email: value is not a valid email address password: String should have at least 8 characters"
    );
  });

  it("uses just the message when a validation error has no location", () => {
    expect(parseErrorDetail([{ type: "value_error", msg: "Invalid request" }])).toBe("Invalid request");
  });

  it.each([undefined, null, { unexpected: true }, 42])(
    "falls back to a generic message for an unexpected detail (%p)",
    (detail) => {
      expect(parseErrorDetail(detail)).toBe("Something went wrong. Please try again.");
    }
  );
});
