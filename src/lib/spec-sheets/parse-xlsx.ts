import * as XLSX from "xlsx";

// Known column headers → normalized object field names.
const HEADER_MAP: Record<string, string> = {
  "Partner": "partner",
  "Flight Dates": "flightDates",
  "Creative Due Date": "creativeDueDate",
  "Market": "market",
  "Placement Name": "placementName",
  "Description": "description",
  "Ad Format": "adFormat",
  "Who Builds Creative": "whoBuilds",
  "Site Served": "siteServed",
  "3rd Party Serving Type": "thirdPartyServingType",
  "Ad Placement": "adPlacement",
  "Creative Type": "creativeType",
  "Ad Dimensions": "adDimensions",
  "File Format": "fileFormat",
  "Max File Size": "maxFileSize",
  "Backup Image Requirements": "backupImage",
  "Aspect Ratio": "aspectRatio",
  "Frame Rate": "frameRate",
  "Bitrate": "bitrate",
  "Audio Specs": "audioSpecs",
  "Animation Length & Looping": "animationLength",
  "Clickthrough URL": "clickthroughUrl",
  "Do you allow Adserving?": "adservingAllowed",
  "Tracking Requirements": "trackingRequirements",
  "Headline Text Limit": "headlineTextLimit",
  "Description Text Limit": "descriptionTextLimit",
  "CTA Requirements": "ctaRequirements",
  "Font & Branding Guidelines": "fontBranding",
  "Third-Party Ad Tags": "thirdPartyAdTags",
  "Viewability & Measurement Requirements": "viewabilityRequirements",
  "GDPR/CCPA Compliance": "gdprCcpaCompliance",
  "Creative Approval Deadlines": "creativeApprovalDeadline",
  "Additional Information": "additionalInformation",
};

export type ParsedPlacement = {
  partner: string | null;
  flightDates: string | null;
  creativeDueDate: string | number | Date | null;
  market: string | null;
  placementName: string | null;
  description: string | null;
  adFormat: string | null;
  whoBuilds: string | null;
  siteServed: string | null;
  thirdPartyServingType: string | null;
  adPlacement: string | null;
  creativeType: string | null;
  adDimensions: string | null;
  fileFormat: string | null;
  maxFileSize: string | null;
  backupImage: string | null;
  aspectRatio: string | null;
  frameRate: string | null;
  bitrate: string | null;
  audioSpecs: string | null;
  animationLength: string | null;
  clickthroughUrl: string | null;
  adservingAllowed: string | null;
  trackingRequirements: string | null;
  headlineTextLimit: string | null;
  descriptionTextLimit: string | null;
  ctaRequirements: string | null;
  fontBranding: string | null;
  thirdPartyAdTags: string | null;
  viewabilityRequirements: string | null;
  gdprCcpaCompliance: string | null;
  creativeApprovalDeadline: string | null;
  additionalInformation: string | null;
  otherFields: Record<string, unknown>;
};

const DEFAULT_FIELDS = Object.values(HEADER_MAP).reduce((acc, k) => {
  acc[k] = null;
  return acc;
}, {} as Record<string, null>);

function normalizeCell(v: unknown): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  }
  return v;
}

// Strip trailing parenthetical clarifications and extra whitespace so
// "Ad Dimensions (Pixels)" matches "Ad Dimensions" in HEADER_MAP.
function normalizeHeader(h: unknown): string {
  return String(h).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const first = rows[i] && rows[i][0];
    if (first != null && String(first).trim().toLowerCase() === "partner") return i;
  }
  return -1;
}

export type ParseResult = {
  placements: ParsedPlacement[];
  warnings: string[];
  headers: string[];
};

export function parseXlsx(input: ArrayBuffer | Uint8Array | Buffer): ParseResult {
  const wb = XLSX.read(input, { type: "array", cellDates: true });
  const sheetNames = wb.SheetNames;
  const warnings: string[] = [];
  if (sheetNames.length > 1) {
    warnings.push(`Workbook has ${sheetNames.length} sheets; using "${sheetNames[0]}"`);
  }
  const ws = wb.Sheets[sheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });

  const headerRowIdx = findHeaderRowIndex(rows);
  if (headerRowIdx < 0) {
    warnings.push('Could not find a header row starting with "Partner" — is this the right sheet?');
    return { placements: [], warnings, headers: [] };
  }

  const headers = (rows[headerRowIdx] as unknown[]).map(h => (h == null ? "" : String(h).trim()));
  const dataRows = rows.slice(headerRowIdx + 2);

  const unknownHeaders = headers.filter(h => h && !HEADER_MAP[normalizeHeader(h)]);
  if (unknownHeaders.length) {
    warnings.push(`Unknown columns collected into otherFields: ${unknownHeaders.join(", ")}`);
  }

  const placements: ParsedPlacement[] = [];
  let lastPartner: string | null = null;

  for (const row of dataRows) {
    if (!row || row.every(c => c == null || c === "")) continue;

    const obj: ParsedPlacement = { ...(DEFAULT_FIELDS as unknown as ParsedPlacement), otherFields: {} };
    headers.forEach((header, i) => {
      const value = normalizeCell(row[i]);
      const fieldName = HEADER_MAP[normalizeHeader(header)];
      if (fieldName) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (obj as any)[fieldName] = value;
      } else if (header) {
        if (value !== null) obj.otherFields[header] = value;
      }
    });

    if (obj.partner == null && lastPartner != null) {
      obj.partner = lastPartner;
    } else if (obj.partner != null) {
      lastPartner = obj.partner as string;
    }

    if (obj.placementName == null && obj.partner == null) continue;

    placements.push(obj);
  }

  return { placements, warnings, headers };
}

export { HEADER_MAP };
