import Link from "next/link";
import { LINK } from "./ui";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`${LINK} no-underline`}>
      {children}
    </Link>
  );
}
