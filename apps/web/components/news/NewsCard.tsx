interface Article {
  id: string;
  aiName: string;
  title: string;
  summary: string;
  ceoInsight: string;
  sourceUrls: string[];
  publishedAt: string;
}

const AI_STYLE: Record<string, { dot: string; badge: string }> = {
  Claude:  { dot: "bg-purple-500", badge: "bg-purple-100 text-purple-700" },
  ChatGPT: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  Gemini:  { dot: "bg-amber-500",  badge: "bg-amber-100 text-amber-700" },
};

function getStyle(aiName: string) {
  return AI_STYLE[aiName] ?? { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600" };
}

export function NewsCard({ article }: { article: Article }) {
  const style = getStyle(article.aiName);
  const time = new Date(article.publishedAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2.5 h-2.5 rounded-full inline-block ${style.dot}`} />
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
            {article.aiName}
          </span>
          <span className="ml-auto text-xs text-slate-400">{time}</span>
        </div>

        <h3 className="text-sm font-bold text-slate-900 mb-2 leading-snug">
          {article.title}
        </h3>

        <p className="text-xs text-slate-600 leading-relaxed mb-3">
          {article.summary}
        </p>

        {article.sourceUrls.length > 0 && (
          <div className="flex gap-3 mt-3">
            {article.sourceUrls.slice(0, 2).map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                ソース {i + 1} →
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
