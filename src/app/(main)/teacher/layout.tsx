import type { ReactNode } from "react";
import { ConsoleFrame } from "../_components/ConsoleFrame";

/** The teacher console's frame stays mounted while its pages change (see ConsoleFrame). */
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <ConsoleFrame area="teacher">{children}</ConsoleFrame>;
}
