// 政府統計の総合窓口 (e-Stat) API v3.0 の薄いクライアント
// 仕様: https://www.e-stat.go.jp/api/api-info/e-stat-manual3-0
const BASE_URL = "https://api.e-stat.go.jp/rest/3.0/app/json";

// 青果物卸売市場調査（農林水産省）の統計調査コード。デフォルトの検索対象。
export const DEFAULT_STATS_CODE = "00500226";

function appId(): string {
  const id = process.env.ESTAT_APP_ID;
  if (!id) {
    throw new Error(
      "ESTAT_APP_ID が未設定です。https://www.e-stat.go.jp/mypage/user/preregister でアプリケーションIDを取得してください。"
    );
  }
  return id;
}

// e-Stat のJSONは要素数が1件だとオブジェクト、複数件だと配列になるため正規化する
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

async function callEstat<T>(endpoint: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("appId", appId());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`e-Stat API HTTPエラー: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export interface StatsTable {
  statsDataId: string;
  title: string;
  govOrg: string;
  cycle: string;
  surveyDate: string;
  openDate: string;
  updatedDate: string;
}

export async function searchStatsTables(params: {
  statsCode?: string;
  searchWord?: string;
  limit?: number;
}): Promise<{ tables: StatsTable[]; totalNumber: number }> {
  const json = await callEstat<any>("getStatsList", {
    statsCode: params.statsCode ?? DEFAULT_STATS_CODE,
    searchWord: params.searchWord,
    limit: params.limit ?? 20,
  });

  const root = json?.GET_STATS_LIST;
  const status = root?.RESULT?.STATUS;
  if (status !== undefined && status !== 0) {
    throw new Error(`e-Stat getStatsList エラー: ${root?.RESULT?.ERROR_MSG ?? status}`);
  }

  const tableInf = toArray(root?.DATALIST_INF?.TABLE_INF);
  const totalNumber = Number(root?.DATALIST_INF?.NUMBER ?? tableInf.length);

  return {
    totalNumber,
    tables: tableInf.map((t: any) => ({
      statsDataId: t["@id"],
      title: typeof t.TITLE === "string" ? t.TITLE : (t.TITLE?.["$"] ?? ""),
      govOrg: t.GOV_ORG?.["$"] ?? t.GOV_ORG ?? "",
      cycle: t.CYCLE ?? "",
      surveyDate: String(t.SURVEY_DATE ?? ""),
      openDate: t.OPEN_DATE ?? "",
      updatedDate: t.UPDATED_DATE ?? "",
    })),
  };
}

export interface ClassAxis {
  id: string; // 例: cat01, area, time, tab
  name: string;
  codes: { code: string; name: string; level?: string }[];
}

export async function getStatsMeta(statsDataId: string): Promise<ClassAxis[]> {
  const json = await callEstat<any>("getMetaInfo", { statsDataId });

  const root = json?.GET_META_INFO;
  const status = root?.RESULT?.STATUS;
  if (status !== undefined && status !== 0) {
    throw new Error(`e-Stat getMetaInfo エラー: ${root?.RESULT?.ERROR_MSG ?? status}`);
  }

  const classObjList = toArray(root?.METADATA_INF?.CLASS_INF?.CLASS_OBJ);

  return classObjList.map((obj: any) => ({
    id: obj["@id"],
    name: obj["@name"],
    codes: toArray(obj.CLASS).map((c: any) => ({
      code: c["@code"],
      name: c["@name"],
      level: c["@level"],
    })),
  }));
}

export interface PriceRecord {
  value: number | null;
  unit?: string;
  tab?: string;
  cat01?: string;
  area?: string;
  time?: string;
}

export async function getStatsData(params: {
  statsDataId: string;
  cdCat01?: string;
  cdArea?: string;
  cdTime?: string;
  cdTab?: string;
  limit?: number;
}): Promise<{ records: PriceRecord[]; totalNumber: number }> {
  const json = await callEstat<any>("getStatsData", {
    statsDataId: params.statsDataId,
    cdCat01: params.cdCat01,
    cdArea: params.cdArea,
    cdTime: params.cdTime,
    cdTab: params.cdTab,
    limit: params.limit ?? 100,
  });

  const root = json?.GET_STATS_DATA;
  const status = root?.RESULT?.STATUS;
  if (status !== undefined && status !== 0) {
    throw new Error(`e-Stat getStatsData エラー: ${root?.RESULT?.ERROR_MSG ?? status}`);
  }

  const dataInf = root?.STATISTICAL_DATA?.DATA_INF;
  const values = toArray(dataInf?.VALUE);
  const totalNumber = Number(root?.STATISTICAL_DATA?.RESULT_INF?.TOTAL_NUMBER ?? values.length);

  return {
    totalNumber,
    records: values.map((v: any) => ({
      value: v["$"] === "" || v["$"] === undefined ? null : Number(v["$"]),
      unit: v["@unit"],
      tab: v["@tab"],
      cat01: v["@cat01"],
      area: v["@area"],
      time: v["@time"],
    })),
  };
}
