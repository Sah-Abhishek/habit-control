import { createAuthClient } from "better-auth/react";

// Same-origin: the auth API is served by this app at /api/auth.
export const authClient = createAuthClient();
