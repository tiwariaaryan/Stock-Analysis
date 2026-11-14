import { useProfile } from "@/components/ProfileProvider";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function useApi() {
  const { userId } = useProfile();

  function url(path: string) {
    return userId ? `${API}${path}?user_id=${userId}` : `${API}${path}`;
  }

  function rawUrl(path: string) {
    return `${API}${path}`;
  }

  return { url, rawUrl, userId, API };
}
