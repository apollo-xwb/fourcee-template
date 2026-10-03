/**
 * Hardcoded knowledge base for Melissa (Fourcee demo chatbot).
 * Used when the chat proxy (OpenRouter) is off, rate limited or fails; also the grounding facts for the model (server side).
 */
import kbJson from '../../server/chat-kb.json';

export interface KnowledgeEntry {
  keywords: string[];
  answer: string;
}

// Single source of truth shared with the server-side chat proxy (server/chat-proxy.mjs builds its grounding from the same file).
export const CHAT_KNOWLEDGE_BASE: KnowledgeEntry[] = kbJson.entries;

const DEFAULT_RESPONSE =
  "I'm Melissa, Fourcee's demo assistant. I can answer questions about **pricing and tiers**, **Nivoda and inventory**, **after-hours coverage**, **integrations** (CRM, calendars), **voice cloning**, **ROI**, or **booking a demo**. Try asking something like: 'What does the Pro tier include?' or 'How does Nivoda integration work?'";

/**
 * Normalize user input for matching (lowercase, trim, collapse spaces).
 */
function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Score how well the query matches an entry (count of keyword matches).
 */
function scoreEntry(query: string, entry: KnowledgeEntry): number {
  const words = normalizeQuery(query).split(/\s+/);
  let score = 0;
  for (const keyword of entry.keywords) {
    const kw = keyword.toLowerCase();
    if (query.includes(kw)) score += 2;
    if (words.some((w) => w.length > 2 && kw.includes(w))) score += 1;
  }
  return score;
}

/**
 * Get a fallback response from the knowledge base, or the default.
 */
export function getFallbackResponse(userMessage: string): string {
  const query = normalizeQuery(userMessage);
  if (!query) return DEFAULT_RESPONSE;

  let best = { score: 0, answer: DEFAULT_RESPONSE };
  for (const entry of CHAT_KNOWLEDGE_BASE) {
    const score = scoreEntry(query, entry);
    if (score > best.score) best = { score, answer: entry.answer };
  }
  return best.answer;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Output goes through dangerouslySetInnerHTML, and model output is untrusted: escape first, then re-add only <strong>/<br />. */
export function formatChatText(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');
}
