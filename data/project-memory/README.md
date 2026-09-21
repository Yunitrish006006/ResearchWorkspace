# 專案記憶

這裡保存使用者確認的長期偏好與可重複執行的工作流程，屬於 ResearchWorkspace 的正式專案資料，可納入版本管理。這不是聊天逐字稿、執行紀錄或研究結果的第二份來源。

## 索引

| 記憶 | 適用情境 | 最後確認 |
| --- | --- | --- |
| [教授報告與講稿製作流程](professor-report-workflow_zh.md) | 教授報告、週報、累積補報、口頭講稿、研究報告 HTML，以及上述文件的續作與改寫 | 2026-09-14 |

## 讀取與維護

1. 開始相關任務前，先完整讀取對應記憶，再按專案研究流程核對來源。入口已記錄於根目錄 `AGENTS.md`。
2. 最新的明確使用者要求優先；記憶中的歷史範例不能取代本次要求。
3. 保存正規化的偏好、操作步驟、限制、確認日期與範例連結，不保存完整對話、憑證、私人執行路徑或隱藏推理。
4. 使用者要求更新專案記憶時，修改原條目並更新確認日期；有實質偏好變動時保留簡短變更說明，避免建立互相矛盾的副本。
5. 論文、報告、圖表、方法、實驗及結果仍由 canonical thesis repository 維護。此處只保存流程並連回原始成果。

## 與其他資料的界線

- `.research-index/`：可重建的索引與執行狀態，不是長期偏好儲存位置。
- `data/research-graph.json`：研究主張及證據關係，不是使用者寫作偏好。
- 本目錄：需明確讀取的流程記憶；目前不會自動注入 CLI/MCP Context Pack。
- `school/docs/reports/`：目前 canonical thesis checkout 的實際報告位置，不在此複製正文。

若 checkout 改名或搬移，先以 `RESEARCH_THESIS_REPO` 或專案 repository discovery 找到 canonical thesis repository，再解析成果路徑。
