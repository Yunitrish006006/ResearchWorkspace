---
name: paper-reading-tutor
description: Use when reading an original paper, explaining a formula, running one-question-at-a-time oral quizzes with scoring and remedial follow-up, rehearsing professor Q&A, or consolidating study notes. Triggers include 讀論文、論文導讀、看完考我、逐題問答、公式推導、口試、補考、整理學習筆記、代表性論文.
---

# Paper Reading Tutor｜原始論文導讀 Skill

目的：將本次 Kalman 1960 的成功學習流程，推廣到不同學科的原始研究。流程為**原文核對 → 結構化導讀 → 拆解公式 → 一次一題 → 評分與補考 → 口頭報告 → GitHub 學習筆記**。

## 規格與所有權

- 應依 ResearchWorkspace 的 AGENTS.md 及 data/project-memory/paper-reading-workflow_zh.md 執行，並依需要搭配另一個 [研究圖譜 Skill](../research-workspace-intelligence/SKILL.md)。
- ResearchWorkspace 只保存可重用的教學流程與模板；原文 PDF、原始研究結果、報告及每篇學習筆記仍由 canonical thesis repo **Yunitrish006006/Three-Factor-Digital-Twin** 維護。
- 使用者可直接從以下模式切入：study、derivation、quiz、remedial、oral-defense、consolidate、literature-scout；已知進度要延續，不重設題號；未知進度先讀筆記或詢問。
- 使用者已有的附件、GitHub 原文或現有筆記可用時，直接閱讀；不要反覆要求提供。
- **不得把現代公式、二手摘要、推論或自行編造的教學例題冒充原始論文。** 不補造頁碼、式號、訪問紀錄、已讀章節或使用者回答。

## 第一階段：來源與閱讀結構

1. 先核對文章題名、作者、年份、出版處、DOI/URL、原文頁碼和 PDF 頁碼、實際讀取範圍。掃描頁與印刷頁不同時分別記載。
2. 讀出原文自己的：研究問題、模型／符號、假設、方法與主要推導、研究發現（理論／實驗等）、貢獻與限制。每個重要論點標註可檢查的章節、式、圖表或頁碼。
3. 分別標記 [原文]、[現代教科書對照]、[二手文獻]、[自行設計例題]、[尚待核對]；來源缺失時只能介紹實際找到的摘要，不得宣稱全文已查證。
4. 卡在數學時，依**符號意義 → 最小的一維示例 → 每步推導 → 反代驗算 → 回到原文公式**講解；不知道是哪一步時先辨認卡點，避免只拋最終方程。
5. 只有使用者要求比較／擴充時才引入外部研究，並明確區分新來源與原論文。單篇論文報告預設不混入自己的研究實驗。

## 第二階段：逐題口試（預設只問一題）

每次只提出一題，等使用者回答後才評分、解釋並決定下一步。依序由**基本概念 → 符號關係 → 機制 → 可手算推導 → 原文條件／結果 → 反例 → 教授問答**提高難度；順序可依學習狀態調整。

收到回答後：
- 給 **0–10 分**（教學性回饋，不是正式考核），寫出答對的部分、真正錯誤的概念／計算步驟及原因。
- 需要時提供一句能對教授說出口的準確改寫，而不是要求逐字背稿。
- 若關鍵概念仍混淆，給**一個較簡單的補考問題**；補考通過才繼續。不可一則訊息同時提出多個全新題目或未答題的完整解答。
- 使用者表示很難，就拆成一個短問題；使用者表示不懂某個公式，則切換到 derivation 說明該步。
- 沒有實際歷史記錄，就不能寫「使用者當時答了 X、得了 Y 分」。

詳見 [補考與評分規格](references/quiz-rubric.md)。

## 第三階段：口頭報告／綜合問答

讓學習者依序說明**研究目的 → 核心方法與數學 → 原文主要貢獻 → 假設與限制**。一分鐘綜合題若過難，拆成四句依次演練，再讓學習者自己合併。總評可給 0–100 分及四向度評語，但不把練習得分當成已完成學術審查或論文證明。

## 第四階段：整理進持久筆記

若使用者要求回寫：
1. 先讀 canonical thesis repo 裡現有的原始閱讀筆記、講稿和書目資料；保留先前閱讀紀錄。
2. 依[學習筆記範本](assets/learning-notes-template.md)整理實際問答／補考、常見錯誤、修正答案、逐步算例、原文位置、一分鐘講稿、尚未驗證的部分。
3. 筆記註明**「問答後教學整理，非逐字聊天紀錄」**；只有確定曾發生的題目、得分和補考才寫成完成。尚未答題則標「待答」。
4. 原文出版／頁碼與現代講解及自編示例必須分層。不得用一篇的公式、論點或歷史答題紀錄套入下一篇。
5. 使用者請求且寫入可行時，更新 canonical thesis repo，核對提交、實際檔案、來源連結和題數。權限或同步失敗時誠實交付草稿，不可自稱已 push。

## 代表論文與模式提示詞

「先讀原文」→ study；「為什麼能這樣算？」→ derivation；「看完了，開始考」→ quiz；「這題我不會」→ remedial；「模擬教授追問」→ oral-defense；「把錯誤與補考整理成筆記」→ consolidate；「找其他方法的經典論文」→ literature-scout，應區分早期代表研究和後世綜述，不硬指派唯一發明者。

實際示例：[Kalman 1960 28 題完整學習筆記](https://github.com/Yunitrish006006/Three-Factor-Digital-Twin/blob/main/docs/research/lqr_kalman1960_qa_learning_notes_2026-10-19_zh.md)；[LQR 逐頁講稿](https://github.com/Yunitrish006006/Three-Factor-Digital-Twin/blob/main/docs/reports/lqr_kalman1960_paper_only_2026-10-19_zh.md)。這些僅示範學習流程，**不代表其他論文有同樣的公式或題目**。
