export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML',
  protect = false,
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, protect_content: protect }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Telegram API error ${res.status}: ${body}`)
  }
}
