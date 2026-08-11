import {
  autoMapCandidateHeaders,
  buildCandidateImportRows,
  parseCandidateCsv,
  parseCandidateResumeText,
} from "@/features/candidates/candidate-import-model";
import type { CandidateRow } from "@/types/database";

describe("candidate import model", () => {
  it("引用符・改行・BOMを含むCSVを解析する", () => {
    const result = parseCandidateCsv(
      '\uFEFF氏名,メールアドレス,メモ\r\n"山田, 太郎",taro@example.com,"1行目\n2行目"',
    );

    expect(result.headers).toEqual(["氏名", "メールアドレス", "メモ"]);
    expect(result.rows).toEqual([
      ["山田, 太郎", "taro@example.com", "1行目\n2行目"],
    ]);
  });

  it("日本語と英語の見出しを重複なく自動対応する", () => {
    expect(
      autoMapCandidateHeaders([
        "氏名",
        "Email Address",
        "現勤務先",
        "氏名",
        "備考",
      ]),
    ).toEqual(["full_name", "email", "current_company", "ignore", "ignore"]);
  });

  it("登録可能行・入力エラー・既存候補者との重複を判定する", () => {
    const parsed = parseCandidateCsv(
      "氏名,メールアドレス,生年月日,希望勤務地\n佐藤 健太,kenta@example.com,1988/4/10,東京都・神奈川県\n,broken,2020/1/1,大阪府",
    );
    const rows = buildCandidateImportRows(
      parsed,
      autoMapCandidateHeaders(parsed.headers),
      [
        {
          id: "candidate-1",
          full_name: "佐藤健太",
          email: "kenta@example.com",
          phone: null,
        } as CandidateRow,
      ],
    );

    expect(rows[0]?.values.birth_date).toBe("1988-04-10");
    expect(rows[0]?.duplicates[0]?.matchedFields).toEqual([
      "氏名",
      "メールアドレス",
    ]);
    expect(rows[1]?.errors).toContain("氏名を入力してください。");
    expect(rows[1]?.errors).toContain(
      "有効なメールアドレスを入力してください。",
    );
  });

  it("同じCSV内の重複行も後続行で検出する", () => {
    const parsed = parseCandidateCsv(
      "氏名,メールアドレス\n山田 太郎,taro@example.com\n山田太郎,TARO@example.com",
    );
    const rows = buildCandidateImportRows(
      parsed,
      autoMapCandidateHeaders(parsed.headers),
      [],
    );

    expect(rows[0]?.duplicates).toHaveLength(0);
    expect(rows[1]?.duplicates[0]?.candidate.id).toBe("csv-row-2");
    expect(rows[1]?.duplicates[0]?.matchedFields).toEqual([
      "氏名",
      "メールアドレス",
    ]);
  });

  it("ラベル付き履歴書テキストを候補者フォームへ変換する", () => {
    const values = parseCandidateResumeText(`
氏名：山田 太郎
フリガナ：ヤマダ タロウ
メールアドレス：taro@example.com
電話番号：090-1234-5678
生年月日：1990年2月3日
現勤務先：メディカル株式会社
職種：医療機器営業
希望勤務地：東京都、神奈川県
希望年収：800万円
`);

    expect(values).toMatchObject({
      full_name: "山田 太郎",
      full_name_kana: "ヤマダ タロウ",
      email: "taro@example.com",
      phone: "090-1234-5678",
      birth_date: "1990-02-03",
      current_company: "メディカル株式会社",
      current_occupation: "医療機器営業",
      desired_locations: "東京都、神奈川県",
      desired_salary_max: "800",
      source: "履歴書・テキスト取り込み",
    });
  });

  it("履歴書からコピーしたタブ区切り表を候補者フォームへ変換する", () => {
    const values = parseCandidateResumeText(`
ふりがな\tさとう たろう\t※性別
氏     名\t佐藤 太郎\t男性
生年月日\t1992 年 4月 5日 （満34歳）
ふりがな\tとうきょうと しぶやく\t電話 090-1111-2222
現住所（〒150-0000）
東京都渋谷区テスト町1-2-3
連絡先\tsato@example.com

年\t月\t学 歴・職 歴
2015\t4\tテスト大学 入学
2019\t3\tテスト大学 卒業
2019\t4\t株式会社サンプル 入社
2024\t7\t株式会社サンプル 医療事業部配属
2025\t4\t医療事業部 係長昇格

年\t月\t免 許・資 格
2018\t1\t普通自動車免許
自己PR
顧客の課題を整理し、チームで改善を進められます。
その他記入欄
法人営業の経験があります。
`);

    expect(values).toMatchObject({
      full_name: "佐藤 太郎",
      full_name_kana: "さとう たろう",
      email: "sato@example.com",
      phone: "090-1111-2222",
      birth_date: "1992-04-05",
      prefecture: "東京都",
      current_company: "株式会社サンプル",
      current_department: "医療事業部",
      current_job_title: "係長",
      strengths: "顧客の課題を整理し、チームで改善を進められます。",
    });
    expect(values.private_notes).toContain("東京都渋谷区テスト町1-2-3");
    expect(values.private_notes).toContain("株式会社サンプル 入社");
    expect(values.private_notes).toContain("普通自動車免許");
    expect(values.private_notes).toContain("法人営業の経験があります。");
  });

  it("壊れたCSVと長すぎるデータを拒否する", () => {
    expect(() => parseCandidateCsv('氏名\n"山田')).toThrow(
      "CSV内の引用符が閉じられていません。",
    );
    expect(() => parseCandidateResumeText("短い")).toThrow();
  });
});
