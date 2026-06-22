import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Application router — routes are file-based under `src/routes/`.
 *
 * Registered paths (auto-generated in `routeTree.gen.ts`):
 *   `/`         → src/routes/index.tsx
 *   `/exam`     → src/routes/exam.tsx
 *   `/examiner` → src/routes/examiner.tsx  (Examiner admin console)
 *
 * All child routes render inside `src/routes/__root.tsx` via `<Outlet />`,
 * which provides QueryClientProvider, global styles, and the HTML shell.
 */
export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
