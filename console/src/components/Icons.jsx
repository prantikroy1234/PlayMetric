// Single-source icon set. All 24x24, stroke-based, inherit currentColor.
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const make = (paths) =>
  function Icon(props) {
    return (
      <svg {...base} {...props}>
        {paths}
      </svg>
    );
  };

export const IconDashboard = make(
  <>
    <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" />
    <path d="M15.5 3.5A9 9 0 0 1 20.5 8.5L15.5 10V3.5Z" />
  </>
);
export const IconCalendar = make(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>
);
export const IconWallet = make(
  <>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7.5Z" />
    <path d="M3 9h13M17.5 13.5h.01" />
  </>
);
export const IconSitemap = make(
  <>
    <rect x="9" y="2.5" width="6" height="5" rx="1.5" />
    <rect x="2.5" y="16.5" width="6" height="5" rx="1.5" />
    <rect x="15.5" y="16.5" width="6" height="5" rx="1.5" />
    <path d="M12 7.5v4M5.5 16.5v-2.5h13v2.5" />
  </>
);
export const IconClock = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 2" />
  </>
);
export const IconBall = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3c3 2.5 4.5 5.8 4.5 9S15 18.5 12 21M12 3C9 5.5 7.5 8.8 7.5 12S9 18.5 12 21M3.4 9.5h17.2M3.4 14.5h17.2" />
  </>
);
export const IconUserCog = make(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6 1 0 2 .2 2.8.6" />
    <circle cx="17.5" cy="17.5" r="2.8" />
    <path d="M17.5 13.4v1.3M17.5 20.3v1.3M21.6 17.5h-1.3M14.7 17.5h-1.3" />
  </>
);
export const IconUser = make(
  <>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20.5c0-4 3.4-6.8 7.5-6.8s7.5 2.8 7.5 6.8" />
  </>
);
export const IconKey = make(
  <>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12.5 20 3.5M17 6.5l2.5 2.5M14.5 9l2 2" />
  </>
);
export const IconContract = make(
  <>
    <path d="M6 2.5h8L19 7v9.5" />
    <path d="M14 2.5V7h5" />
    <path d="M6 2.5A1.5 1.5 0 0 0 4.5 4v14A1.5 1.5 0 0 0 6 19.5h5" />
    <path d="M13.5 21.5c1.2-1.6 2-2.6 3-2.6s1.2 1.4 2.3 1.4 1.6-1 2.7-2.3" />
  </>
);
export const IconUsers = make(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.7 3-6.2 6.5-6.2s6.5 2.5 6.5 6.2" />
    <path d="M16 5.2a3.4 3.4 0 0 1 0 5.6M18 14.2c2 .8 3.5 2.7 3.5 5.3" />
  </>
);
export const IconChart = make(
  <>
    <path d="M3 20.5h18" />
    <path d="M6 20.5V12M11 20.5V5.5M16 20.5v-6M21 20.5V9" />
  </>
);
export const IconStar = make(
  <path d="M12 3.5l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.5-4 6-.6L12 3.5Z" />
);
export const IconTicket = make(
  <>
    <path d="M3 9.5V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5Z" />
    <path d="M14 5v14" strokeDasharray="2 2.5" />
  </>
);
export const IconSearch = make(
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21" />
  </>
);
export const IconSettings = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V8a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </>
);
export const IconBell = make(
  <>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5Z" />
    <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
  </>
);
export const IconChevronDown = make(<path d="m6 9 6 6 6-6" />);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconEdit = make(
  <>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m15 6 3 3" />
  </>
);
export const IconTrash = make(
  <>
    <path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
  </>
);
export const IconExternal = make(
  <>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </>
);
export const IconClose = make(<path d="M6 6l12 12M18 6 6 18" />);
export const IconBuilding = make(
  <>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
  </>
);
export const IconLayers = make(
  <>
    <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
    <path d="m3 12.5 9 4.5 9-4.5M3 16.8l9 4.5 9-4.5" />
  </>
);
export const IconPin = make(
  <>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </>
);
export const IconDatabase = make(
  <>
    <ellipse cx="12" cy="6" rx="8" ry="3.2" />
    <path d="M4 6v12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V6" />
    <path d="M4 12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" />
  </>
);
