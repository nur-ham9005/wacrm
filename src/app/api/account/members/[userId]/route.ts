// ============================================================
// /api/account/members/[userId]
//
//   PATCH  — change a member's role.   Admin+.
//   DELETE — remove a member.          Admin+.
//
// Both delegate to SECURITY DEFINER RPCs from migration 018:
//   - set_member_role(p_user_id, p_new_role)
//   - remove_account_member(p_user_id)
//
// The RPCs do the *real* authorisation work — caller must be
// admin+, target must be in caller's account, target can't be the
// owner, can't be self. The TS layer here only forwards the call
// and maps Postgres SQLSTATEs back to HTTP statuses.
// ============================================================

import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isAccountRole } from "@/lib/auth/roles";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

// Map known SQLSTATEs from the RPCs (see migration 018) onto HTTP
// statuses. The `error.code` field is the SQLSTATE; the `message`
// is the human-readable RAISE message we put in the migration.
function rpcErrorToResponse(err: PostgrestError): NextResponse {
  if (err.code === "42501") {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err.code === "22023") {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error("[members route] unexpected RPC error:", err);
  return NextResponse.json(
    { error: "Failed to update member" },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireRole("admin");

    const limit = checkRateLimit(
      `admin:memberRole:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { userId } = await params;

    const body = (await request.json().catch(() => null)) as
      | { role?: unknown; is_available?: unknown; max_concurrent?: unknown }
      | null;

    // -------- Availability / capacity update --------
    // Written via the service-role client (profiles RLS only lets a
    // user update their own row), but only after confirming the target
    // belongs to the caller's account.
    const hasAvailability =
      body?.is_available !== undefined || body?.max_concurrent !== undefined;
    if (hasAvailability) {
      if (body?.is_available !== undefined && typeof body.is_available !== "boolean") {
        return NextResponse.json(
          { error: "'is_available' must be a boolean" },
          { status: 400 },
        );
      }
      if (
        body?.max_concurrent !== undefined &&
        (typeof body.max_concurrent !== "number" ||
          !Number.isInteger(body.max_concurrent) ||
          body.max_concurrent < 1 ||
          body.max_concurrent > 50)
      ) {
        return NextResponse.json(
          { error: "'max_concurrent' must be an integer between 1 and 50" },
          { status: 400 },
        );
      }

      const { data: target } = await ctx.supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!target || target.account_id !== ctx.accountId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const patch: { is_available?: boolean; max_concurrent?: number } = {};
      if (body?.is_available !== undefined) patch.is_available = body.is_available;
      if (body?.max_concurrent !== undefined) patch.max_concurrent = body.max_concurrent;

      const { error } = await supabaseAdmin()
        .from("profiles")
        .update(patch)
        .eq("user_id", userId);
      if (error) {
        console.error("[members route] availability update error:", error);
        return NextResponse.json(
          { error: "Failed to update member" },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------- Role update (existing RPC flow) --------
    const role = body?.role;

    if (!isAccountRole(role)) {
      return NextResponse.json(
        { error: "'role' must be one of owner, admin, agent, viewer" },
        { status: 400 },
      );
    }

    // The RPC blocks promotion to / demotion from owner, but
    // surface the friendlier 400 before crossing the wire too.
    if (role === "owner") {
      return NextResponse.json(
        {
          error:
            "Use POST /api/account/transfer-ownership to promote a member to owner",
        },
        { status: 400 },
      );
    }

    const { error } = await ctx.supabase.rpc("set_member_role", {
      p_user_id: userId,
      p_new_role: role,
    });

    if (error) return rpcErrorToResponse(error);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireRole("admin");

    const limit = checkRateLimit(
      `admin:memberRemove:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { userId } = await params;

    const { data, error } = await ctx.supabase.rpc("remove_account_member", {
      p_user_id: userId,
    });

    if (error) return rpcErrorToResponse(error);

    return NextResponse.json({ ok: true, newPersonalAccountId: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
