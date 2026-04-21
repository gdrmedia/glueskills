import type React from "react";

type PartnerIconProps = { iconId: string; size?: number };

export function PartnerIcon({ iconId, size = 14 }: PartnerIconProps): React.ReactElement {
  const s = size;
  const common: React.SVGProps<SVGSVGElement> = {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": true,
  };
  switch (iconId) {
    case "meta":
      return (<svg {...common}><path d="M12 3c-3.3 0-5.5 2.3-7 5-1.5 2.6-2.3 5.5-2 7.5.2 1.7 1.2 3 3 3 1.5 0 2.6-.9 4-3 .9-1.4 1.6-2.6 2-3.2.4.6 1.1 1.8 2 3.2 1.4 2.1 2.5 3 4 3 1.8 0 2.8-1.3 3-3 .3-2-.5-4.9-2-7.5-1.5-2.7-3.7-5-7-5zm0 2.5c2.2 0 3.8 1.6 5 3.8 1.3 2.2 2 4.6 1.8 6-.1.8-.5 1.2-1.3 1.2-.7 0-1.4-.5-2.4-2-.9-1.4-1.7-2.7-2.1-3.4-.3-.6-.7-1.1-1-1.1s-.7.5-1 1.1c-.4.7-1.2 2-2.1 3.4-1 1.5-1.7 2-2.4 2-.8 0-1.2-.4-1.3-1.2-.2-1.4.5-3.8 1.8-6 1.2-2.2 2.8-3.8 5-3.8z"/></svg>);
    case "reddit":
      return (<svg {...common}><path d="M22 12c0-1.4-1.1-2.5-2.5-2.5-.7 0-1.3.3-1.8.8-1.6-1-3.6-1.7-5.8-1.8l1-4.5 3.1.7c0 .9.7 1.6 1.6 1.6.9 0 1.6-.7 1.6-1.6s-.7-1.6-1.6-1.6c-.6 0-1.2.4-1.5.9l-3.5-.8c-.2 0-.4.1-.5.3l-1.1 5c-2.2.1-4.3.8-5.9 1.8-.4-.5-1.1-.8-1.8-.8-1.4 0-2.5 1.1-2.5 2.5 0 1 .6 1.8 1.4 2.2-.1.3-.1.6-.1 1 0 3.3 3.8 6 8.5 6s8.5-2.7 8.5-6c0-.4 0-.7-.1-1 .8-.4 1.4-1.2 1.4-2.2zm-14.5 1c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5-.7 1.5-1.5 1.5-1.5-.7-1.5-1.5zm8.3 3.8c-1 1-2.6 1.2-3.8 1.2s-2.8-.2-3.8-1.2c-.2-.2-.2-.5 0-.7s.5-.2.7 0c.6.6 1.9.9 3.1.9s2.5-.2 3.1-.9c.2-.2.5-.2.7 0s.2.5 0 .7zm-.3-2.3c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/></svg>);
    case "tiktok":
      return (<svg {...common}><path d="M19.3 7.4c-1.4-.3-2.6-1.1-3.4-2.3-.3-.5-.5-1-.6-1.6V3h-3v12.3c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7c.3 0 .6 0 .8.1v-3c-.3 0-.5-.1-.8-.1-3.1 0-5.7 2.5-5.7 5.7S5.9 21 9.1 21s5.7-2.6 5.7-5.7V9.6c1.2.8 2.6 1.3 4 1.3v-3c-.2-.1-.3-.1-.5-.2-.1-.1-.1-.2 0-.3z"/></svg>);
    case "smartly":
      return (<svg {...common}><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>);
    case "transmit":
    case "pmp":
    case "pubmatic":
    case "dmv":
      return (<svg {...common}><rect x="3" y="5" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M8 20h8M12 17v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/><path d="M10 11 15 8.5V13.5L10 11z"/></svg>);
    case "youtubectv":
    case "youtubeolv":
      return (<svg {...common}><path d="M22 6.5c-.2-.9-.9-1.6-1.8-1.8C18.5 4.2 12 4.2 12 4.2s-6.5 0-8.2.5C2.9 4.9 2.2 5.6 2 6.5 1.5 8.2 1.5 12 1.5 12s0 3.8.5 5.5c.2.9.9 1.6 1.8 1.8 1.7.5 8.2.5 8.2.5s6.5 0 8.2-.5c.9-.2 1.6-.9 1.8-1.8.5-1.7.5-5.5.5-5.5s0-3.8-.5-5.5zM10 15.5v-7l5.5 3.5-5.5 3.5z"/></svg>);
    case "directv":
      return (<svg {...common}><path d="M3 6.5C3 5.1 4.1 4 5.5 4h10C17.9 4 20 6.1 20 8.5v7c0 2.4-2.1 4.5-4.5 4.5h-10C4.1 20 3 18.9 3 17.5v-11z"/><circle cx="18" cy="6" r="2" fill="white"/></svg>);
    case "spotify":
      return (<svg {...common}><circle cx="12" cy="12" r="10"/><path d="M7 10c3-1 7-1 10 1M7.5 13c2.5-.7 5.5-.5 8 1M8 16c2-.5 4-.3 6 .8" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none"/></svg>);
    case "pandora":
      return (<svg {...common}><path d="M5 3h10c2.2 0 4 1.8 4 4v4c0 2.2-1.8 4-4 4h-5v6H5V3z"/></svg>);
    case "google":
      return (<svg {...common}><path d="M21.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.3c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.2 3-7.1z"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.4c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.5C4.6 19.8 8.1 22 12 22z" opacity=".85"/><path d="M6.4 14.1c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.6H3C2.4 9 2 10.4 2 12s.4 3 1 4.4l3.4-2.3z" opacity=".6"/><path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 2.9 14.7 2 12 2 8.1 2 4.6 4.2 3 7.6l3.4 2.5C7.2 7.7 9.4 5.9 12 5.9z" opacity=".75"/></svg>);
    case "yelp":
      return (<svg {...common}><path d="M11 3c-.3 0-.6.1-.8.2-1 .4-3.8 1.9-5.4 3.4-.4.4-.5 1-.2 1.5l4 6c.3.5.9.6 1.3.3.4-.3.6-.8.4-1.3L8 5.5c-.1-.4 0-.9.3-1.2.3-.3.8-.4 1.2-.3l1.3.4c.4.1.7.5.7.9v6.4c0 .5.4.9.9 1l1.6.2c.4 0 .8-.2 1-.6l3-4.5c.2-.3.2-.7 0-1l-.9-1.2c-.2-.3-.6-.5-1-.4-1.3.2-4.9.7-4.9.7L11 3z"/></svg>);
    default:
      return (<svg {...common}><circle cx="12" cy="12" r="6"/></svg>);
  }
}
