import "server-only";

/**
 * Low-level Telegram Bot API sender. Posts a message to the Clippa
 * community supergroup, optionally into a specific forum topic.
 *
 * Every send is best-effort — a Telegram failure must never roll back or
 * block the action that triggered it (a payout, a cron run).
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather; absent ⇒ no-op
 *   TELEGRAM_CHAT_ID    — the supergroup id (negative, e.g. -1001234567890)
 */

export async function sendToTopic(
  topicId: string | undefined,
  text: string,
  chatIdOverride?: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdOverride ?? process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN / CHAT_ID not set — skipping");
    return { ok: false, error: "telegram not configured" };
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  // Forum supergroups route messages into topics via message_thread_id.
  if (topicId) body.message_thread_id = Number(topicId);

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const error = `telegram ${res.status}: ${errBody.slice(0, 200)}`;
      console.error(`[telegram] ${error}`);
      return { ok: false, error };
    }
    console.log(`[telegram] sent to topic=${topicId ?? "main"}`);
    return { ok: true };
  } catch (e) {
    const error = (e as Error).message;
    console.error(`[telegram] send failed: ${error}`);
    return { ok: false, error };
  }
}
