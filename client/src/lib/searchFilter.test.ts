import { describe, it, expect } from "vitest";
import { ilikeValue, orIlike } from "./searchFilter";

describe("ilikeValue", () => {
  it("wraps the term in quotes and wildcards", () => {
    expect(ilikeValue("cup")).toBe('"%cup%"');
  });

  it("trims", () => {
    expect(ilikeValue("  cup  ")).toBe('"%cup%"');
  });

  it("leaves a comma literal instead of ending the predicate", () => {
    // Unquoted, this comma was read as PostgREST or() grammar and the request
    // came back HTTP 400 — verified live against the project.
    expect(ilikeValue("cup,box")).toBe('"%cup,box%"');
  });

  it("leaves parens literal", () => {
    expect(ilikeValue("Cup (250ml)")).toBe('"%Cup (250ml)%"');
  });

  it("escapes double quotes, which would otherwise close the value", () => {
    expect(ilikeValue('say "hi"')).toBe('"%say \\"hi\\"%"');
  });

  it("escapes backslashes BEFORE quotes, so an escape is not re-escaped", () => {
    expect(ilikeValue("a\\b")).toBe('"%a\\\\b%"');
    // The dangerous ordering bug: escaping quotes first would turn \" into
    // \\" and let the value terminate early.
    expect(ilikeValue('a\\"b')).toBe('"%a\\\\\\"b%"');
  });
});

describe("orIlike", () => {
  it("builds one predicate per column", () => {
    expect(orIlike("cup", ["name", "description"])).toBe(
      'name.ilike."%cup%",description.ilike."%cup%"'
    );
  });

  it("returns null for an empty or whitespace term", () => {
    expect(orIlike("", ["name"])).toBeNull();
    expect(orIlike("   ", ["name"])).toBeNull();
  });

  it("returns null when no columns are given", () => {
    expect(orIlike("cup", [])).toBeNull();
  });

  it("cannot inject an extra predicate", () => {
    // The whole attack shape: a term that closes the value and adds a filter.
    const hostile = 'zz%,is_active.eq.false,name.ilike.%zz';
    const out = orIlike(hostile, ["name"])!;

    // The payload sits ENTIRELY inside the quoted value — that is the property
    // that matters. (Counting occurrences of ".ilike." would be meaningless
    // here: the hostile string contains that literal text itself, so it appears
    // twice by construction, once as grammar and once as data.)
    expect(out).toBe(`name.ilike."%${hostile}%"`);

    // Nothing escapes the quotes: everything after the opening quote up to the
    // final quote is the payload, so no injected predicate is ever top-level.
    const value = out.slice('name.ilike.'.length);
    expect(value.startsWith('"')).toBe(true);
    expect(value.endsWith('"')).toBe(true);
    expect(value.slice(1, -1)).toBe(`%${hostile}%`);
  });
});
