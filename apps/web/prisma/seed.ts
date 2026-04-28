import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const today = new Date();
today.setHours(0, 0, 0, 0);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

const articles = [
  // 本日分
  {
    newsDate: today,
    type: "daily" as const,
    aiName: "Claude",
    title: "Claude Mythos Preview 公開 — セキュリティ分野で突出した能力を発揮",
    summary:
      "Anthropicが新モデル「Claude Mythos」のプレビューを公開。コンピュータセキュリティタスクで卓越した能力を持ち、FreeBSDに潜む17年前のリモートコード実行脆弱性を自律的に発見・悪用することに成功。能力が高すぎるとして一般公開は見送られ、50組織限定の「Project Glasswing」枠のみで提供される。AI史上初めて「強すぎて公開できない」と判断されたモデルとなった。",
    ceoInsight:
      "AIの能力向上が規制・法的リスクと直結する時代に突入しました。自社でAIを導入・開発する際は能力評価だけでなく「社会的受容性」と「法的リスク審査」をセットにしたガバナンス体制の整備が急務です。",
    sourceUrls: ["https://red.anthropic.com/2026/mythos-preview/"],
    publishedAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
  },
  {
    newsDate: today,
    type: "daily" as const,
    aiName: "Claude",
    title: "AWS と Anthropic がパートナーシップ強化 — Claude Cowork が Amazon Bedrock に対応",
    summary:
      "AnthropicはAWS Trainium/Graviton上でモデルをトレーニングする体制を整備。Claude CoworkがAmazon Bedrockで利用可能になり、企業内データをAWS外に出さずにClaudeと協業できる環境が整う。同時にAnthropicはシドニーオフィスを正式開設し、アジア太平洋地域への本格展開を加速している。",
    ceoInsight:
      "AWSとの統合強化により、既存のAWSインフラを持つ企業はClaudeをより低コスト・低リスクで導入できます。クラウド戦略の見直しにあわせてAI活用基盤を検討する好機です。",
    sourceUrls: [
      "https://aws.amazon.com/blogs/aws/aws-weekly-roundup-anthropic-meta-partnership-aws-lambda-s3-files-amazon-bedrock-agentcore-cli-and-more-april-27-2026/",
    ],
    publishedAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
  },
  {
    newsDate: today,
    type: "daily" as const,
    aiName: "ChatGPT",
    title: "GPT-5.5 リリース — マルチステップ推論とエージェント機能を大幅強化",
    summary:
      "OpenAIがGPT-5.5を正式リリース。複雑な目標を理解しながらツールを駆使してコード作成・調査・分析・文書作成などを自律的に進める能力が大幅に向上した。GPT-5.5およびGPT-5.5 ProはAPIでも提供開始。ChatGPT Businessでは日本向けに国内リージョンでのデータ保存が全アプリに拡大し、国内企業の採用ハードルが低下した。",
    ceoInsight:
      "エージェント型AIの実用性が一段と高まりました。従来は人手だった「情報収集→判断→アウトプット」を繰り返す業務プロセスをリストアップし、今期中に優先的に自動化する投資判断を行うべきタイミングです。",
    sourceUrls: ["https://openai.com/index/introducing-gpt-5-5/"],
    publishedAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
  },
  {
    newsDate: today,
    type: "daily" as const,
    aiName: "ChatGPT",
    title: "OpenAI が新ミッションステートメントを公開 — AGIより「普及」を優先する方針に転換",
    summary:
      "OpenAIが「Our Principles」を更新。AGI到達よりもAI技術の広範な普及を優先する姿勢に転換し、権力集中リスクへの懸念も明記した。同日、Elon MuskがOpenAIに対して起こした「Nonprofit返還・金銭補償」を求める訴訟の公判が開始。AI業界の企業統治を問う「テストケース」として注目を集めている。",
    ceoInsight:
      "OpenAIの「普及優先」転換はAPI価格低下・機能開放の加速を意味します。AI組み込みコストが今後さらに下がる前提で、競合との差別化軸をAI利用の「深さ・独自性」に移す戦略設計が必要です。",
    sourceUrls: ["https://ca.news.yahoo.com/openai-just-changed-principals-changing-112531234.html"],
    publishedAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
  },
  {
    newsDate: today,
    type: "daily" as const,
    aiName: "Gemini",
    title: "Gemini に「Proactive Assistance」機能 — 先回りして提案する能動的AIへ",
    summary:
      "Geminiアプリのベータ版にProactive Assistance機能が発見された。Gmail・カレンダー・通知・画面表示をリアルタイム分析し、ユーザーが尋ねる前に能動的に提案を行う。「受動的なAIアシスタント時代の終わり」と評されており、GmailへのAI Overview統合拡大やGoogle Photosとの連携も同時に進んでいる。",
    ceoInsight:
      "AIは「聞かれたら答える」から「先回りして提案する」へ移行中です。自社プロダクトのUXがこの潮流に乗り遅れると、ユーザー体験の格差が急速に拡大します。次のロードマップにプロアクティブ機能の検討を組み込む時期です。",
    sourceUrls: ["https://easternherald.com/2026/04/28/google-gemini-signals-end-of-passive-ai-assistants/"],
    publishedAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
  },
  {
    newsDate: today,
    type: "daily" as const,
    aiName: "Gemini",
    title: "Google が「Gemini Enterprise」を発表 — 企業向けAI基盤を統合・強化",
    summary:
      "GoogleはVertex AIをリブランドし「Gemini Enterprise」として統一。AIエージェント向けガバナンス・セキュリティ機能を新たに発表し、エンタープライズ収益化を本格化させた。一方、EU規制当局はAndroidでGeminiのみに提供している機能を競合AIにも開放するよう是正勧告を出しており、規制対応が課題となっている。",
    ceoInsight:
      "GoogleがエンタープライズAIを本格的なマネタイズ軸に据えたことで、SaaS・クラウド市場の競争構造が変わります。自社のGoogle Workspace依存度を確認し、AIガバナンス・セキュリティ要件の整理を早期に行うことを推奨します。",
    sourceUrls: ["https://cyprusshippingnews.com/2026/04/27/google-puts-ai-agents-at-heart-of-its-enterprise-money-making-push/"],
    publishedAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
  },

  // 昨日分
  {
    newsDate: yesterday,
    type: "daily" as const,
    aiName: "Claude",
    title: "Anthropic が Claude 4 系モデルのAPI価格を改定 — 大規模利用コストが最大30%低下",
    summary:
      "AnthropicはClaude 4系モデルの入力トークン単価を最大30%引き下げると発表。特に長文コンテキストを多用するエンタープライズ向けユースケースで大幅なコスト削減が期待できる。同時にバッチAPI処理の上限も引き上げられ、大量データ処理のユースケースが広がっている。",
    ceoInsight:
      "Claude APIの価格低下は、AI活用のROIが改善するタイミングです。導入を検討・保留していたプロジェクトの採算性を再評価し、投資判断を前倒しできる可能性があります。",
    sourceUrls: ["https://www.anthropic.com/news"],
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
  },
  {
    newsDate: yesterday,
    type: "daily" as const,
    aiName: "ChatGPT",
    title: "OpenAI と Qualcomm がスマートフォン向けAIチップを共同開発 — エッジAI時代が本格化",
    summary:
      "OpenAIがQualcomm・MediaTekとAIスマートフォン向けプロセッサを共同開発しているとの報道を受け、Qualcomm株が時間外取引で13%急騰。クラウドに依存せずデバイス上でAI処理を完結させる「エッジAI」の実用化が加速し、モバイルアプリのAI体験が大きく変わる可能性がある。",
    ceoInsight:
      "エッジAIの普及は、クラウドAI依存のコスト構造を変える大きな転換点です。自社サービスのモバイル戦略にエッジAI活用を組み込むロードマップの検討を始める時期です。",
    sourceUrls: ["https://money.usnews.com/investing/news/articles/2026-04-27/qualcomm-surges-on-report-of-openai-tie-up-for-ai-smartphone-processors"],
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
  },
  {
    newsDate: yesterday,
    type: "daily" as const,
    aiName: "Gemini",
    title: "Gmail 検索に Gemini AI Overview が拡大 — Business・Enterprise・Education 向けに展開",
    summary:
      "GoogleはGemini搭載のAI OverviewをGmail検索のBusiness・Enterprise・Educationアカウントに展開開始。メール内の情報をAIが横断的に要約・提示する機能で、大量のメールを扱うビジネスユーザーの情報処理効率が大幅に向上することが期待される。",
    ceoInsight:
      "Google WorkspaceへのAI深化が加速しています。業務メールの情報処理効率が上がることで、ナレッジワーカーの生産性向上が見込める一方、機密情報の取り扱いポリシーの見直しが必要になります。",
    sourceUrls: ["https://www.ghacks.net/2026/04/27/gmail-search-now-shows-ai-overviews-powered-by-gemini-for-business-and-enterprise-users/"],
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
  },
];

async function main() {
  console.log("Seeding news articles...");

  await prisma.newsArticle.deleteMany({
    where: { newsDate: { in: [today, yesterday] } },
  });

  const result = await prisma.newsArticle.createMany({ data: articles });
  console.log(`Created ${result.count} articles.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
