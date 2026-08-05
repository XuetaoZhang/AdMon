"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, MessageSquareText } from "lucide-react";

const navigation = [
  { href: "/", label: "Home", icon: Activity },
  { href: "/demo", label: "Live agent", icon: MessageSquareText },
  { href: "/dashboard", label: "Manage", icon: LayoutDashboard }
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <Link className="brand-lockup" href="/" aria-label="AdMon home">
        <span className="brand-mark">AM</span>
        <span className="brand-copy">
          <strong>AdMon</strong>
          <small>Agent advertising network</small>
        </span>
      </Link>
      <nav className="site-nav" aria-label="Primary navigation">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link className={active ? "active" : ""} href={href} key={href}>
              <Icon size={15} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <span className="network-pill">
        <span className="network-dot" /> Monad testnet
      </span>
    </header>
  );
}
