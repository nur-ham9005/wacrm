import type { SupabaseClient } from '@supabase/supabase-js';
import { engineSendText } from '@/lib/automations/meta-send';

/**
 * Send a short self-introduction from the newly-assigned agent to the
 * customer. Skipped when there's no agent or the assignee didn't change
 * (re-assigning the same agent shouldn't re-introduce). Best-effort —
 * a send failure is logged, never thrown, so it can't break assignment.
 */
export async function sendAgentIntro(args: {
  db: SupabaseClient;
  accountId: string;
  conversationId: string;
  contactId: string;
  agentId: string | null;
  previousAgentId?: string | null;
}): Promise<void> {
  const { db, accountId, conversationId, contactId, agentId, previousAgentId } =
    args;
  if (!agentId || agentId === previousAgentId) return;

  try {
    const { data: profile } = await db
      .from('profiles')
      .select('full_name')
      .eq('user_id', agentId)
      .maybeSingle();
    const name = profile?.full_name ?? 'petugas Customer Service';
    const text = `Perkenalkan, saya ${name}, petugas Customer Service yang bertugas hari ini — siap membantu Kakak. 😊`;
    await engineSendText({
      accountId,
      userId: agentId,
      conversationId,
      contactId,
      text,
    });
  } catch (err) {
    console.error('[agent-intro] send failed:', err);
  }
}
