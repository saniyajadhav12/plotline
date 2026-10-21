import { languageName } from "./languages";

describe("languageName", () => {
  it("names common TMDb language codes in English", () => {
    expect(languageName("ko")).toBe("Korean");
    expect(languageName("hi")).toBe("Hindi");
    expect(languageName("fr")).toBe("French");
  });

  it("ignores letter case", () => {
    expect(languageName("KO")).toBe("Korean");
  });

  it("handles TMDb's non-standard codes", () => {
    expect(languageName("cn")).toBe("Cantonese");
    expect(languageName("xx")).toBeNull();
  });

  it("returns null for missing or unrecognised codes instead of a raw code", () => {
    expect(languageName(null)).toBeNull();
    expect(languageName(undefined)).toBeNull();
    expect(languageName("")).toBeNull();
    expect(languageName("zz")).toBeNull();
  });
});
