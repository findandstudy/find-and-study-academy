import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Get session from localStorage - only send user ID, server will validate and determine role
function getAuthHeaders(): Record<string, string> {
  try {
    console.log('=== CLIENT AUTH DEBUG ===');
    const sessionData = localStorage.getItem('fas_session');
    console.log('Session data raw:', sessionData);
    
    if (!sessionData) {
      console.log('No session data found');
      return {};
    }
    
    const session = JSON.parse(sessionData);
    console.log('Parsed session:', session);
    
    if (session?.user?.id) {
      const headers = {
        'x-user-id': String(session.user.id)
        // Note: No longer sending x-user-role - server validates user and gets role from database
      };
      console.log('Auth headers to send:', headers);
      return headers;
    } else {
      console.log('Session exists but missing user.id:', session);
    }
  } catch (error) {
    console.error('Failed to get auth headers:', error);
  }
  return {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(data ? { "Content-Type": "application/json" } : {})
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = getAuthHeaders();
    const res = await fetch(queryKey.join("/") as string, {
      headers: authHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
