import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing Supabase env vars. Copy .env.example to .env and fill in your project URL + anon key."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ---- Shared types matching supabase/schema.sql ----

export type UserRole = "user" | "ngo" | "admin"| "company";
export type VerificationStatus = "pending_verification" | "approved" | "rejected";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  city: string | null;
  verification_status: VerificationStatus;
  account_status: AccountStatus;   // ← add this line
  created_at: string;
}

export interface Ngo {
  id: string;
  profile_id: string;
  org_name: string;
  category: string;
  description: string | null;
  city: string | null;
  registration_doc_url: string | null;
  created_at: string;
}

export type PostType = "stray_found" | "announcement" | "adoption" | "update";

export interface Post {
  id: string;
  author_id: string;
  type: PostType;
  title: string;
  description: string | null;
  photo_url: string | null;
  city: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  ngo_id: string;
  title: string;
  goal_amount: number;
  raised_amount: number;
  deadline: string | null;
  created_at: string;
}

export interface Donation {
  id: string;
  donor_id: string;
  ngo_id: string;
  campaign_id: string | null;
  amount: number;
  status: "pending" | "success" | "failed";
  payment_ref: string | null;
  created_at: string;
}

export interface FoodListing {
  id: string;
  business_id: string;
  description: string;
  quantity: string;
  pickup_by: string;
  claimed_by_ngo_id: string | null;
  status: "open" | "claimed" | "expired";
  city: string | null;
  created_at: string;
}

export interface BookDonation {
  id: string;
  owner_id: string;
  item_desc: string;
  status: "available" | "reserved" | "fulfilled";
  requested_by: string | null;
  created_at: string;
}

export interface VolunteerRequest {
  id: string;
  ngo_id: string;
  title: string;
  description: string | null;
  slots_needed: number;
  event_date: string | null;
  interested_users: string[];
  created_at: string;
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  type: string;
  ref_id: string | null;
  message: string | null;
  read_status: boolean;
  created_at: string;
}

export type AccountStatus = "active" | "suspended" | "flagged";

export interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: "ngo" | "user";
  target_id: string;
  reason: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  ngo_id: string;
  created_at: string;
  last_message_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface CsrEngagement {
  id: string;
  company_id: string;
  ngo_id: string;
  engagement_type: "donation" | "volunteer_hours" | "food_drive" | "other";
  amount: number | null;
  hours: number | null;
  description: string | null;
  engagement_date: string;
  created_at: string;
}