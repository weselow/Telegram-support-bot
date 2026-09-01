/**
 * Escaping for the HTML parse mode of the Telegram Bot API.
 *
 * Every bot message that carries a name, a page address or anything else chosen
 * outside the project goes out as HTML rather than Markdown. Markdown is the
 * worse choice here for two reasons: its markers (_ * [ ] ` ) appear in ordinary
 * names and page addresses, and a broken markup makes Telegram reject the whole
 * message — so the notification silently never arrives.
 */

/**
 * Text made safe for the HTML parse mode
 *
 * Only the three characters the Telegram parser reacts to are replaced, which
 * is exactly what its documentation asks for. The ampersand goes first: were it
 * last, it would hit the entities produced a moment earlier and turn `<` into a
 * visible `&amp;lt;`.
 *
 * Attribute values are a different context — a quote character is not escaped
 * here. Everything this project puts inside href is built from digits
 * (tg://user?id=…, https://t.me/c/…), so nothing chosen from outside ever
 * reaches an attribute. Keep it that way.
 *
 * @param text - Text from outside the project
 * @returns The same text with `&`, `<` and `>` replaced by entities
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
