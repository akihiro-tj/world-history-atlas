Feature: カラーテーマ切替
  # 軸: 初期値 = OS 設定 / 保存値 × 操作 = トグル / リロード
  # E2E で扱わない: トグルの DOM 反映・OS 設定追従 → component（App.test.tsx）/ 初期値の解決ロジック → unit（colorTheme.test.ts）

  Scenario: 選択したカラーテーマはリロード後も維持される
    Given アプリを開いている
    And カラーテーマトグルをクリックする
    When ページをリロードする
    Then ダークテーマが適用されている
