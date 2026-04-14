// ============================================================
// Core domain types for CampusConnect
// ============================================================

export interface User {
  uid: string;
  email: string;
  name: string;
  hostel_block: "talpona" | "terekhol";
  room_number?: string;
  upi_vpa?: string;
  reputation_score: number;
  lifetime_earnings: number;
  lifetime_ordered: number;
  deliveries_count: number;
  is_active_pilot: boolean;
  current_geohash?: string;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  source: "upahar_ghar" | "nescafe";
  name: string;
  price: number;
  category: "snacks" | "beverages" | "meals" | "desserts";
  is_available: boolean;
  image_url?: string;
}

export interface DropLocation {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  is_active: boolean;
}

export type OrderStatus =
  | "open"
  | "accepted"
  | "purchased"
  | "in_transit"
  | "arrived"
  | "completed"
  | "cancelled";

export interface Order {
  id: string;
  requester_uid: string;
  pilot_uid?: string;
  status: OrderStatus;
  source: "upahar_ghar" | "nescafe";
  items_text: string;
  estimated_cost: number;
  incentive: number;
  total_amount: number;
  drop_location_id: string;
  drop_location_name: string;
  floor_number?: string;
  handover_otp?: string;
  special_instructions?: string;
  surge_multiplier: number;
  accepted_at?: string;
  purchased_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  requester?: { name: string; hostel_block: string };
}

export interface Rating {
  id: string;
  order_id: string;
  rater_uid: string;
  rated_uid: string;
  score: number;
  comment?: string;
  created_at: string;
}

export interface SurgeInfo {
  surge_multiplier: number;
  open_orders: number;
  active_pilots: number;
  is_raining: boolean;
  message: string;
}

export interface LeaderboardEntry {
  uid: string;
  name: string;
  hostel_block: string;
  deliveries_count: number;
  lifetime_earnings: number;
  reputation_score: number;
}

// WebSocket message types
export interface WsLocationMsg {
  type: "location";
  lat: number;
  lng: number;
  role: string;
  timestamp: number;
}

export interface WsChatMsg {
  type: "chat";
  text: string;
  role: string;
  timestamp: number;
}

export interface WsStatusMsg {
  type: "status";
  status: OrderStatus;
  role: string;
  timestamp: number;
}

export type WsMessage = WsLocationMsg | WsChatMsg | WsStatusMsg;

// Cart item for local state
export interface CartItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  source: "upahar_ghar" | "nescafe";
}
