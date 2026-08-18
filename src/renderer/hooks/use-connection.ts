import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useConnection() {
  return useQuery({
    queryKey: ["connection"],
    enabled: Boolean(window.deployDeck),
    queryFn: () => window.deployDeck.connections.status(),
  });
}

export function useConnect() {
  const client = useQueryClient();
  return {
    vercel: useMutation({
      mutationFn: (token: string) => window.deployDeck.connections.connectVercel(token),
      onSuccess: () => client.invalidateQueries(),
    }),
    cloudflare: useMutation({
      mutationFn: (token: string) => window.deployDeck.connections.connectCloudflare(token),
      onSuccess: () => client.invalidateQueries(),
    }),
    disconnect: useMutation({
      mutationFn: (provider: "vercel" | "cloudflare") => window.deployDeck.connections.disconnect(provider),
      onSuccess: () => client.invalidateQueries(),
    }),
  };
}

export function usePrefs() {
  return useQuery({
    queryKey: ["prefs"],
    enabled: Boolean(window.deployDeck),
    queryFn: () => window.deployDeck.prefs.get(),
  });
}
