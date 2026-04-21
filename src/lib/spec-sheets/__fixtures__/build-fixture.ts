// Generates sample.xlsx in this folder AND exports the expected parsed
// placement-object array. Used as single source of truth by parser tests.

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Header row — matches the real client template exactly.
export const HEADERS = [
  'Partner', 'Flight Dates', 'Creative Due Date', 'Market',
  'Placement Name', 'Description', 'Ad Format',
  'Who Builds Creative', 'Site Served', '3rd Party Serving Type',
  'Ad Placement', 'Creative Type', 'Ad Dimensions', 'File Format',
  'Max File Size', 'Backup Image Requirements', 'Aspect Ratio', 'Frame Rate',
  'Bitrate', 'Audio Specs', 'Animation Length & Looping',
  'Clickthrough URL', 'Do you allow Adserving?', 'Tracking Requirements',
  'Headline Text Limit', 'Description Text Limit', 'CTA Requirements',
  'Font & Branding Guidelines', 'Third-Party Ad Tags',
  'Viewability & Measurement Requirements', 'GDPR/CCPA Compliance',
  'Creative Approval Deadlines', 'Additional Information'
];

// Guidance row — the second row in the real template that describes each column.
export const GUIDANCE = [
  'Where the ads will run', 'Start and end dates', 'Due dates', 'Language Preference',
  'What placement', 'Description of placement', 'Display, video, etc.',
  '', '', '', 'In-stream, out-stream, etc.', 'Static, animated, etc.',
  'Width × Height', 'JPG, PNG, etc.', 'Limits by platform', 'For HTML5',
  'Required for video', 'Important for video', 'Video encoding', 'If applicable',
  'Duration and loops', 'Landing page', 'UTM parameters', 'UTM parameters',
  'Character count', 'Length of body', 'Button text', 'Approved fonts',
  'DCM, Sizmek, etc.', 'MOAT, IAS', 'Data privacy', 'Lead time', 'Links'
];

// Data rows — Partner column is blank on continuation rows to simulate merged cells.
export const ROWS = [
  ['Meta', '1/4-7/18', '10-Dec', 'GM', 'Reach & Trending Reels',
   'Short-form video ads featured in Reels.', 'Social Video',
   'Agency', 'Y', 'N/A', 'Instagram Reels', 'HTML5', '1080 × 1920',
   'MP4 or MOV', '4 GB', 'N/A', '1080 × 1920', '', '', '', '',
   '', '', '', '27 characters', '30 characters', 'Shop Now',
   '', 'N/A', 'N/A', '', '', ''],
  ['', '1/4-7/18', '10-Dec', 'GM', 'DPA',
   'A DPA automatically pulls products from the catalog.', 'Social Dynamic Carousel',
   'Agency', 'Y', 'N/A', 'in-feed', 'Static', '1080 × 1080',
   'JPG or PNG', '30 MB: Image', 'N/A', '1080 × 1080', '', '', '', '',
   '', '', '', '27 characters', '30 characters', 'Shop Now',
   '', 'N/A', 'N/A', '', '', ''],
  ['Reddit', '1/4-7/18', '10-Dec', 'GM', 'In-Feed & Freeform',
   'Ads that appear natively in users\u2019 Reddit feeds.', 'Social Video & Image',
   'Agency', 'Y', 'N/A', 'in-feed', 'HTML5 or Static',
   '1920 x 1080\n1440 x 1080\n1080 x 1080\n1200 x 1500',
   'JPG or PNG\nMP4 or MOV', '1 GB: Video\n5 MB: Image', 'N/A',
   '1920 x 1080\n1440 x 1080\n1080 x 1080\n1200 x 1500', '', '', '', '',
   '', '', '', '150-300 characters', 'N/A', 'Shop Now',
   '', 'N/A', 'N/A', '', '', ''],
  ['', 'TBD Q1', 'TBD', 'GM', 'Category Takeover',
   'Premium ad placement where a brand dominates a category for 24hr.',
   'Social Video & Image', 'Agency', 'Y', 'N/A',
   'Homepage, Category Pages', 'HTML5 or Static',
   '1920 x 1080\n1080 x 1080', 'JPG or PNG', '1 GB: Video',
   'N/A', '1920 x 1080', '', '', '', '',
   '', '', '', '150-300 characters', 'N/A', 'Shop Now',
   '', 'N/A', 'N/A', '', '', ''],
  ['TikTok', '1/4-7/18', '10-Dec', 'GM', 'In-Feed',
   'Native video ads in the \u201CFor You\u201D feed.', 'Social Video',
   'Agency', 'Y', 'N/A', 'in-feed', 'HTML5', '1080 × 1920',
   'MP4 or MOV', '500 MB', 'N/A', '1080 × 1920', '', '', '', '',
   '', '', '', '125-150 characters', '45-50 characters', 'Shop Now',
   '', 'N/A', 'N/A', '', '', '']
];

// Expected parsed output — tests assert deep equality against this.
export const EXPECTED = [
  {
    partner: 'Meta', flightDates: '1/4-7/18', creativeDueDate: '10-Dec', market: 'GM',
    placementName: 'Reach & Trending Reels',
    description: 'Short-form video ads featured in Reels.',
    adFormat: 'Social Video', whoBuilds: 'Agency', siteServed: 'Y',
    thirdPartyServingType: 'N/A', adPlacement: 'Instagram Reels', creativeType: 'HTML5',
    adDimensions: '1080 × 1920', fileFormat: 'MP4 or MOV', maxFileSize: '4 GB',
    backupImage: 'N/A', aspectRatio: '1080 × 1920', frameRate: null, bitrate: null,
    audioSpecs: null, animationLength: null, clickthroughUrl: null,
    adservingAllowed: null, trackingRequirements: null,
    headlineTextLimit: '27 characters', descriptionTextLimit: '30 characters',
    ctaRequirements: 'Shop Now', fontBranding: null,
    thirdPartyAdTags: 'N/A', viewabilityRequirements: 'N/A',
    gdprCcpaCompliance: null, creativeApprovalDeadline: null,
    additionalInformation: null, otherFields: {}
  },
  {
    partner: 'Meta', flightDates: '1/4-7/18', creativeDueDate: '10-Dec', market: 'GM',
    placementName: 'DPA',
    description: 'A DPA automatically pulls products from the catalog.',
    adFormat: 'Social Dynamic Carousel', whoBuilds: 'Agency', siteServed: 'Y',
    thirdPartyServingType: 'N/A', adPlacement: 'in-feed', creativeType: 'Static',
    adDimensions: '1080 × 1080', fileFormat: 'JPG or PNG', maxFileSize: '30 MB: Image',
    backupImage: 'N/A', aspectRatio: '1080 × 1080', frameRate: null, bitrate: null,
    audioSpecs: null, animationLength: null, clickthroughUrl: null,
    adservingAllowed: null, trackingRequirements: null,
    headlineTextLimit: '27 characters', descriptionTextLimit: '30 characters',
    ctaRequirements: 'Shop Now', fontBranding: null,
    thirdPartyAdTags: 'N/A', viewabilityRequirements: 'N/A',
    gdprCcpaCompliance: null, creativeApprovalDeadline: null,
    additionalInformation: null, otherFields: {}
  },
  {
    partner: 'Reddit', flightDates: '1/4-7/18', creativeDueDate: '10-Dec', market: 'GM',
    placementName: 'In-Feed & Freeform',
    description: 'Ads that appear natively in users\u2019 Reddit feeds.',
    adFormat: 'Social Video & Image', whoBuilds: 'Agency', siteServed: 'Y',
    thirdPartyServingType: 'N/A', adPlacement: 'in-feed', creativeType: 'HTML5 or Static',
    adDimensions: '1920 x 1080\n1440 x 1080\n1080 x 1080\n1200 x 1500',
    fileFormat: 'JPG or PNG\nMP4 or MOV', maxFileSize: '1 GB: Video\n5 MB: Image',
    backupImage: 'N/A',
    aspectRatio: '1920 x 1080\n1440 x 1080\n1080 x 1080\n1200 x 1500',
    frameRate: null, bitrate: null, audioSpecs: null, animationLength: null,
    clickthroughUrl: null, adservingAllowed: null, trackingRequirements: null,
    headlineTextLimit: '150-300 characters', descriptionTextLimit: 'N/A',
    ctaRequirements: 'Shop Now', fontBranding: null,
    thirdPartyAdTags: 'N/A', viewabilityRequirements: 'N/A',
    gdprCcpaCompliance: null, creativeApprovalDeadline: null,
    additionalInformation: null, otherFields: {}
  },
  {
    partner: 'Reddit', flightDates: 'TBD Q1', creativeDueDate: 'TBD', market: 'GM',
    placementName: 'Category Takeover',
    description: 'Premium ad placement where a brand dominates a category for 24hr.',
    adFormat: 'Social Video & Image', whoBuilds: 'Agency', siteServed: 'Y',
    thirdPartyServingType: 'N/A', adPlacement: 'Homepage, Category Pages',
    creativeType: 'HTML5 or Static',
    adDimensions: '1920 x 1080\n1080 x 1080', fileFormat: 'JPG or PNG',
    maxFileSize: '1 GB: Video', backupImage: 'N/A', aspectRatio: '1920 x 1080',
    frameRate: null, bitrate: null, audioSpecs: null, animationLength: null,
    clickthroughUrl: null, adservingAllowed: null, trackingRequirements: null,
    headlineTextLimit: '150-300 characters', descriptionTextLimit: 'N/A',
    ctaRequirements: 'Shop Now', fontBranding: null,
    thirdPartyAdTags: 'N/A', viewabilityRequirements: 'N/A',
    gdprCcpaCompliance: null, creativeApprovalDeadline: null,
    additionalInformation: null, otherFields: {}
  },
  {
    partner: 'TikTok', flightDates: '1/4-7/18', creativeDueDate: '10-Dec', market: 'GM',
    placementName: 'In-Feed',
    description: 'Native video ads in the \u201CFor You\u201D feed.',
    adFormat: 'Social Video', whoBuilds: 'Agency', siteServed: 'Y',
    thirdPartyServingType: 'N/A', adPlacement: 'in-feed', creativeType: 'HTML5',
    adDimensions: '1080 × 1920', fileFormat: 'MP4 or MOV', maxFileSize: '500 MB',
    backupImage: 'N/A', aspectRatio: '1080 × 1920', frameRate: null, bitrate: null,
    audioSpecs: null, animationLength: null, clickthroughUrl: null,
    adservingAllowed: null, trackingRequirements: null,
    headlineTextLimit: '125-150 characters', descriptionTextLimit: '45-50 characters',
    ctaRequirements: 'Shop Now', fontBranding: null,
    thirdPartyAdTags: 'N/A', viewabilityRequirements: 'N/A',
    gdprCcpaCompliance: null, creativeApprovalDeadline: null,
    additionalInformation: null, otherFields: {}
  }
];

export function build() {
  const aoa = [HEADERS, GUIDANCE, ...ROWS];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Specs');
  const outPath = path.join(__dirname, 'sample.xlsx');
  XLSX.writeFile(wb, outPath);
  return outPath;
}

export type ExpectedPlacement = typeof EXPECTED[number];
