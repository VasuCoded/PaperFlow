/**
 * Toasts, without putting the toast library on any page's critical path: it is
 * fetched the first time something is announced (the Toaster that shows them
 * loads after the page is up, see MotionProvider). Errors stay inline next to
 * the form they belong to; these are for short confirmations.
 */
export function toastSuccess(message: string, description?: string) {
  void import("sonner").then(({ toast }) => toast.success(message, description ? { description } : undefined));
}
