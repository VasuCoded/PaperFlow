"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import { TRANSITION } from "@/lib/motion";

const loadFeatures = () => import("./features").then((m) => m.default);
// the toast library arrives after the page is up; nothing is announced before that
const Toaster = dynamic(() => import("sonner").then((m) => m.Toaster), { ssr: false });

/**
 * Motion and toasts for the whole app.
 *
 * Elements use the slim `m` components (motion/react-m); the animation engine
 * and the toast library arrive in their own chunks after the page is up (until
 * then elements render as plain elements, so nothing waits for them). Anyone
 * who asks their device for reduced motion gets none. Every animation defaults
 * to the app's one curve and duration.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={TRANSITION}>
        {children}
        <Toaster
          position="bottom-center"
          offset={20}
          mobileOffset={{ bottom: 84 }}
          gap={8}
          duration={2600}
          toastOptions={{ unstyled: true, classNames: { toast: "pf-toast", success: "ok", error: "bad", icon: "pf-toast-ic" } }}
        />
      </MotionConfig>
    </LazyMotion>
  );
}
