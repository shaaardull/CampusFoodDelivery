import type {
  User,
  MenuItem,
  Order,
  DropLocation,
  SurgeInfo,
  LeaderboardEntry,
} from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============================================================
// Fetch wrapper with auth
// ============================================================
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ============================================================
// Auth
// ============================================================
export async function sendOtp(email: string) {
  return request<{ message: string; dev_otp?: string }>("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(email: string, otp: string) {
  return request<{ token?: string; user?: User; is_new: boolean }>(
    "/auth/verify-otp",
    { method: "POST", body: JSON.stringify({ email, otp }) }
  );
}

export async function register(data: {
  email: string;
  otp: string;
  name: string;
  hostel_block: string;
  room_number?: string;
  upi_vpa?: string;
}) {
  return request<{ token: string; user: User }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============================================================
// Users
// ============================================================
export async function getMe() {
  return request<{ user: User }>("/users/me");
}

export async function updateMe(data: Partial<Pick<User, "name" | "hostel_block" | "room_number" | "upi_vpa">>) {
  return request<{ user: User }>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getPublicProfile(uid: string) {
  return request<{ user: Partial<User> }>(`/users/${uid}/public`);
}

// ============================================================
// Menu
// ============================================================
export async function getMenu(source?: string, category?: string) {
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (category) params.set("category", category);
  const qs = params.toString();
  return request<{ items: MenuItem[] }>(`/menu/${qs ? `?${qs}` : ""}`);
}

export async function getSurge() {
  return request<SurgeInfo>("/menu/surge");
}

export async function getDropLocations() {
  return request<{ locations: DropLocation[] }>("/menu/locations");
}

// ============================================================
// Orders
// ============================================================
export async function placeOrder(data: {
  source: string;
  items_text: string;
  estimated_cost: number;
  incentive: number;
  drop_location_id: string;
  drop_location_name: string;
  floor_number?: string;
  special_instructions?: string;
}) {
  return request<{ order: Order }>("/orders/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getOpenOrders(source?: string) {
  const qs = source ? `?source=${source}` : "";
  return request<{ orders: Order[] }>(`/orders/open${qs}`);
}

export async function getMyOrders() {
  return request<{ orders: Order[] }>("/orders/my");
}

export async function getOrder(orderId: string) {
  return request<{ order: Order }>(`/orders/${orderId}`);
}

export async function acceptOrder(orderId: string) {
  return request<{ order: Order }>(`/orders/${orderId}/accept`, {
    method: "POST",
  });
}

export async function advanceStatus(orderId: string) {
  return request<{ order: Order }>(`/orders/${orderId}/status`, {
    method: "POST",
  });
}

export async function completeOrder(orderId: string, otp: string) {
  return request<{ order: Order }>(`/orders/${orderId}/complete?otp=${otp}`, {
    method: "POST",
  });
}

export async function cancelOrder(orderId: string, reason?: string) {
  return request<{ order: Order }>(`/orders/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function rateOrder(
  orderId: string,
  score: number,
  comment?: string
) {
  return request<{ rating: unknown }>(`/orders/${orderId}/rate`, {
    method: "POST",
    body: JSON.stringify({ score, comment }),
  });
}

// ============================================================
// Leaderboard
// ============================================================
export async function getLeaderboard(limit = 20) {
  return request<{ leaderboard: LeaderboardEntry[] }>(
    `/leaderboard/?limit=${limit}`
  );
}

// ============================================================
// Push
// ============================================================
export async function subscribePush(data: {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}) {
  return request<{ message: string }>("/push/subscribe", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
