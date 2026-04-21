import { describe, expect, it, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { parseXlsx } from "./parse-xlsx";
import { build, EXPECTED } from "./__fixtures__/build-fixture";

const FIXTURE_PATH = path.join(__dirname, "__fixtures__", "sample.xlsx");

beforeAll(() => {
  if (!fs.existsSync(FIXTURE_PATH)) build();
});

function readFixture(): Uint8Array {
  return new Uint8Array(fs.readFileSync(FIXTURE_PATH));
}

describe("parseXlsx", () => {
  it("returns the expected placements from the canonical fixture", () => {
    const result = parseXlsx(readFixture());
    expect(result.placements).toHaveLength(EXPECTED.length);
    expect(result.placements).toEqual(EXPECTED);
  });

  it("inherits Partner across empty rows (merged cells)", () => {
    const { placements } = parseXlsx(readFixture());
    expect(placements[1].partner).toBe("Meta");
    expect(placements[3].partner).toBe("Reddit");
  });

  it("skips the guidance row", () => {
    const { placements } = parseXlsx(readFixture());
    const partners = placements.map(p => p.partner);
    expect(partners).not.toContain("Where the ads will run");
  });

  it("normalizes empty cells to null and preserves 'N/A'", () => {
    const { placements } = parseXlsx(readFixture());
    expect(placements[0].frameRate).toBeNull();
    expect(placements[0].thirdPartyServingType).toBe("N/A");
  });

  it("collects unknown columns into otherFields", () => {
    const aoa = [
      ["Partner", "Placement Name", "Ad Dimensions", "Custom Client Field"],
      ["desc", "desc", "desc", "desc"],
      ["Meta", "Reels", "1080 × 1920", "special note"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Specs");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const { placements } = parseXlsx(new Uint8Array(buf));
    expect(placements[0].otherFields["Custom Client Field"]).toBe("special note");
  });

  it("skips preamble rows to find headers by 'Partner'", () => {
    const aoa = [
      ["ACME", null, null, null],
      ["H1'26 Media", null, null, null],
      ["NEW Partner/Buy **", null, null, null],
      ["Partner", "Placement Name", "Ad Dimensions", "File Format"],
      ["desc", "desc", "desc", "desc"],
      ["Meta", "Reels", "1080 × 1920", "MP4"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Specs");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const { placements } = parseXlsx(new Uint8Array(buf));
    expect(placements).toHaveLength(1);
    expect(placements[0].partner).toBe("Meta");
    expect(placements[0].placementName).toBe("Reels");
    expect(placements[0].adDimensions).toBe("1080 × 1920");
  });

  it("matches headers with parenthetical clarifications", () => {
    const aoa = [
      ["Partner", "Placement Name", "Ad Dimensions (Pixels)", "File Format ", "Who Builds Creative (Agency or Partner)"],
      ["desc", "desc", "desc", "desc", "desc"],
      ["Meta", "Reels", "1080 × 1920", "MP4", "Agency"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Specs");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const { placements } = parseXlsx(new Uint8Array(buf));
    expect(placements[0].adDimensions).toBe("1080 × 1920");
    expect(placements[0].fileFormat).toBe("MP4");
    expect(placements[0].whoBuilds).toBe("Agency");
  });

  it("warns when no Partner header is found", () => {
    const aoa = [["Foo", "Bar"], ["a", "b"]];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Specs");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = parseXlsx(new Uint8Array(buf));
    expect(result.placements).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/Partner/);
  });
});
