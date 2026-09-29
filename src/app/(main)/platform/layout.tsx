import type { ReactNode } from "react";
import { ConsoleFrame } from "../_components/ConsoleFrame";

/** The platform console's frame stays mounted while its pages change (see ConsoleFrame). */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <ConsoleFrame area="platform">{children}</ConsoleFrame>;
}
