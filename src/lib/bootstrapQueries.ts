import { queryClient } from './queryClient';
import { fetchDashboardStats, fetchProjects, fetchTickets } from './api';

/**
 * Prefetch critical queries into the TanStack Query cache.
 * Call this after successful login.
 */
export async function bootstrapQueries() {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['dashboardStats'],
      queryFn: fetchDashboardStats,
      staleTime: 60_000
    }),
    queryClient.prefetchQuery({
      queryKey: ['projects'],
      queryFn: fetchProjects,
      staleTime: 60_000
    }),
    queryClient.prefetchQuery({
      queryKey: ['tickets'],
      queryFn: fetchTickets,
      staleTime: 60_000
    })
  ]);
}
