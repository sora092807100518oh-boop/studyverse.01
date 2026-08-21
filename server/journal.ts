import { z } from "zod";
import { invokeLLM } from "./_core/llm";

const GDELT_ARTICLE_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const HACKER_NEWS_SEARCH_ENDPOINT = "https://hn.algolia.com/api/v1/search_by_date";

const articleSchema = z.object({
  title: z.string().min(1).max(240),
  body: z.string().min(120).max(5000),
  questions: z.array(z.object({ question: z.string().min(1).max(300), answer: z.string().min(1).max(300), explanation: z.string().min(1).max(600) })).length(3),
});

export type JournalArticle = z.infer<typeof articleSchema>;
export type NewsSource = { title: string; url: string; domain: string };

function toNewsSource(item: { title?: string; url?: string; domain?: string }): NewsSource | undefined {
  if (typeof item.title !== "string" || typeof item.url !== "string" || !/^https:\/\//.test(item.url)) return undefined;
  return { title: item.title.slice(0, 500), url: item.url, domain: item.domain ?? new URL(item.url).hostname };
}

async function fetchGdeltNewsSource(): Promise<NewsSource> {
  const url = new URL(GDELT_ARTICLE_ENDPOINT);
  url.searchParams.set("query", "(science OR education OR environment OR technology)");
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "10");
  url.searchParams.set("timespan", "1d");
  const response = await fetch(url, { signal: AbortSignal.timeout(6_000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("NEWS_SOURCE_UNAVAILABLE");
  const payload = await response.json() as { articles?: Array<{ title?: string; url?: string; domain?: string }> };
  const source = payload.articles?.map(toNewsSource).find((item): item is NewsSource => Boolean(item));
  if (!source) throw new Error("NEWS_SOURCE_UNAVAILABLE");
  return source;
}

async function fetchHackerNewsSource(): Promise<NewsSource> {
  const url = new URL(HACKER_NEWS_SEARCH_ENDPOINT);
  url.searchParams.set("query", "education technology science");
  url.searchParams.set("tags", "story");
  url.searchParams.set("hitsPerPage", "10");
  const response = await fetch(url, { signal: AbortSignal.timeout(6_000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("NEWS_SOURCE_UNAVAILABLE");
  const payload = await response.json() as { hits?: Array<{ title?: string; story_title?: string; url?: string; story_url?: string }> };
  const source = payload.hits?.map(item => toNewsSource({ title: item.title ?? item.story_title, url: item.url ?? item.story_url })).find((item): item is NewsSource => Boolean(item));
  if (!source) throw new Error("NEWS_SOURCE_UNAVAILABLE");
  return source;
}

export async function fetchTodayNewsSource(): Promise<NewsSource> {
  try {
    return await fetchGdeltNewsSource();
  } catch {
    try {
      return await fetchHackerNewsSource();
    } catch {
      throw new Error("NEWS_SOURCE_UNAVAILABLE");
    }
  }
}

export async function generateJournalArticle(input: { subject: "english" | "kanji"; difficulty: string; source?: NewsSource }): Promise<JournalArticle> {
  const sourceContext = input.source ? `Use this current-news headline only as a topic prompt. Do not add unverified facts or quote the article. Headline: ${input.source.title}.` : "Create an original, factual-neutral study passage about a broadly useful academic theme.";
  const languageInstruction = input.subject === "english" ? "Write the reading passage in accessible English suitable for Japanese learners." : "Write the reading passage in clear Japanese with a focus on useful kanji vocabulary.";
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You create safe, age-appropriate reading practice. Avoid graphic, political persuasion, medical, legal, financial, or personally identifying content. Produce only the requested JSON. The source headline is a topic cue, not evidence." },
      { role: "user", content: `${languageInstruction} Target level: ${input.difficulty}. ${sourceContext} Create one title, a 180–260 word reading passage, and exactly three comprehension questions. Each question needs a short answer and a concise explanation.` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "studyverse_journal", strict: true, schema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" }, questions: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" }, explanation: { type: "string" } }, required: ["question", "answer", "explanation"], additionalProperties: false } } }, required: ["title", "body", "questions"], additionalProperties: false } } },
    max_tokens: 1400,
  });
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("JOURNAL_GENERATION_FAILED");
  try { return articleSchema.parse(JSON.parse(content)); } catch { throw new Error("JOURNAL_GENERATION_FAILED"); }
}
