/**
 * The browser Supabase client, loaded on demand.
 *
 * Sign-in, sign-up and change-password only need the client when the button is
 * pressed. Importing it statically put about 70 kB of JavaScript on those pages
 * (the heaviest in the app), downloaded before anyone had typed anything. This
 * fetches it at the moment it is needed, then reuses it.
 */
let loading: Promise<typeof import("./client")> | null = null;

export async function loadBrowserClient() {
  loading ??= import("./client");
  const { createClient } = await loading;
  return createClient();
}
