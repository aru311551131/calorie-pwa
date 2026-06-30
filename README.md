# 每日營養紀錄 PWA

這是一個純前端 PWA，用來記錄每日食物、熱量與蛋白質，也可以用內建營養表依份量計算熱量與蛋白質。

## 功能

- 日曆選日期
- 記錄每日體重
- 新增每日食物紀錄：日期、食物名稱、蛋白質、熱量
- 自動加總選取日期的總熱量與總蛋白質
- 日曆格子顯示每天體重、熱量與蛋白質小計
- 匯出指定日期區間的每日體重、熱量與蛋白質 CSV
- 內建肉品生食重與雞蛋營養表
- 依份數快速試算營養素
- 新增自己的食物到營養表，並自由設定基準文字
- Email 登入後同步到 Supabase
- PWA manifest 與 Service Worker，可安裝到手機主畫面並離線開啟

## Supabase 設定

1. 到 Supabase Project 的 `SQL Editor`。
2. 執行 `supabase-schema.sql`。
3. 到 `Authentication` -> `URL Configuration`。
4. `Site URL` 設成 `https://aru311551131.github.io/calorie-pwa/`。
5. 如果有 `Redirect URLs`，加入 `https://aru311551131.github.io/calorie-pwa/`。

登入後，app 會把目前本機資料和雲端資料合併，再同步到 Supabase。未登入時仍可用本機模式。

## GitHub Pages 部署

1. 建立一個 GitHub repo。
2. 把這個資料夾裡的所有檔案放到 repo 根目錄。
3. 到 GitHub repo 的 `Settings` -> `Pages`。
4. `Build and deployment` 選 `Deploy from a branch`。
5. Branch 選 `main`，資料夾選 `/root`，按 Save。
6. GitHub 產生網址後，用 iPhone Safari 開啟。

## iPhone 安裝方式

1. 用 Safari 打開 GitHub Pages 網址。
2. 點分享按鈕。
3. 選「加入主畫面」。
4. 之後就可以像 app 一樣從主畫面開啟。

## 資料儲存

資料存在目前裝置瀏覽器的 `localStorage`。換手機、清除 Safari 網站資料、或換瀏覽器時，紀錄不會自動同步。

如果之後需要跨裝置同步，可以再加 GitHub Gist、Supabase、Firebase 或 iCloud CloudKit 版本。
