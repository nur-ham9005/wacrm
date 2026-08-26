import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { resolveRoundRobinAgent } from '@/lib/automations/engine';
import { sendAgentIntro } from '@/lib/inbox/agent-intro';

/**
 * POST /api/conversations/[id]/assign
 *
 * Body: { agent_id: string | null }
 *   - agent_id set  → assign/transfer to that specific agent.
 *   - agent_id null → release (unassign), then auto re-assign via
 *     round-robin to the next least-loaded available agent (excluding
 *     the caller so the chat doesn't bounce straight back).
 *
 * Permission: owner/admin may assign/unassign any conversation. An agent
 * may only change assignment on a conversation that is unassigned or
 * already assigned to them — mirroring the reply lock.
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole('agent');
    const { id } = await params;

    const body = (await request.json().catch(() => null)) as
      | { agent_id?: string | null }
      | null;

    const admin = supabaseAdmin();

    const { data: conv } = await admin
      .from('conversations')
      .select('id, account_id, contact_id, assigned_agent_id')
      .eq('id', id)
      .maybeSingle();

    if (!conv || conv.account_id !== ctx.accountId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isAdmin = ctx.role === 'owner' || ctx.role === 'admin';
    const currentAssignee = conv.assigned_agent_id ?? null;

    if (!isAdmin && currentAssignee && currentAssignee !== ctx.userId) {
      return NextResponse.json(
        { error: 'This conversation is assigned to another agent' },
        { status: 403 },
      );
    }

    let nextAssignee: string | null = null;
    if (body?.agent_id) {
      nextAssignee = body.agent_id;
    } else {
      nextAssignee = await resolveRoundRobinAgent(
        admin,
        ctx.accountId,
        ctx.userId,
      );
    }

    const { error } = await admin
      .from('conversations')
      .update({ assigned_agent_id: nextAssignee })
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update assignment' },
        { status: 500 },
      );
    }

    // Introduce the newly-assigned agent to the customer (best-effort).
    if (nextAssignee) {
      await sendAgentIntro({
        db: admin,
        accountId: ctx.accountId,
        conversationId: id,
        contactId: conv.contact_id,
        agentId: nextAssignee,
        previousAgentId: currentAssignee,
      });
    }

    return NextResponse.json({ assigned_agent_id: nextAssignee });
  } catch (err) {
    return toErrorResponse(err);
  }
}
