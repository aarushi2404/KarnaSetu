import { supabase } from "./supabase";

export type AuditAction =
  | "approve_ngo"
  | "reject_ngo"
  | "suspend_account"
  | "flag_account"
  | "reactivate_account";

export async function logAdminAction(
  adminId: string,
  action: AuditAction,
  targetType: "ngo" | "user",
  targetId: string,
  reason?: string
) {
  const { error } = await supabase.from("audit_logs").insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    reason: reason ?? null,
  });
  if (error) console.warn("Failed to write audit log:", error.message);
}