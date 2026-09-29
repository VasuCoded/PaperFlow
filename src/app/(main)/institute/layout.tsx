import type { ReactNode } from "react";
import { ConsoleFrame } from "../_components/ConsoleFrame";

/** The institute console's frame stays mounted while its pages change (see ConsoleFrame). */
export default function InstituteLayout({ children }: { children: ReactNode }) {
  return <ConsoleFrame area="institute">{children}</ConsoleFrame>;
}
