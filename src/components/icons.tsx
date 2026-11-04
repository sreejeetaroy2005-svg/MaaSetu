/**
 * Inline SVG icons — always paired with text, never used alone to carry
 * meaning (low-literacy support). Decorative for screen readers.
 */
interface IconProps {
  className?: string;
}

function base(className?: string) {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function DashCircleIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M19 12H5m7-7-7 7 7 7" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 12h14m-7-7 7 7-7 7" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
      <path d="m14 6 4 4" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function HeartIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1Z" />
    </svg>
  );
}

export function HealthWorkerIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5 21c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" />
      <path d="M17.5 3.5v5M15 6h5" />
    </svg>
  );
}

export function LogOutIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3Z" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function WifiIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M2 8.8a16 16 0 0 1 20 0M5 12.6a11 11 0 0 1 14 0M8.5 16.4a6 6 0 0 1 7 0" />
      <path d="M12 20h.01" />
    </svg>
  );
}

export function WifiOffIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M2 2l20 20" />
      <path d="M8.5 16.4a6 6 0 0 1 7 0M5 12.6a11 11 0 0 1 5-2.6M2 8.8a16 16 0 0 1 5-2.6M14.5 6.4a16 16 0 0 1 7.5 2.4" />
      <path d="M12 20h.01" />
    </svg>
  );
}

export function GaugeIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 18a9 9 0 1 1 16 0" />
      <path d="M12 14l4-4" />
      <path d="M4 18h4M16 18h4" />
    </svg>
  );
}

export function CloudDoneIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 18h11a4 4 0 0 0 .6-7.9A6 6 0 0 0 6.2 9 4.5 4.5 0 0 0 6 18Z" />
      <path d="m10 13 2 2 4-4" />
    </svg>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4h-4" />
    </svg>
  );
}

export function QrIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 20h3" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  );
}

export function SmsIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8Z" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
