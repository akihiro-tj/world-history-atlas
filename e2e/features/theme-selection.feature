Feature: テーマ選択
  # 軸: テーマ = 未選択 / 選択済み / 切替 × 入口 = サイドバー / 直リンク
  # E2E で扱わない: 一覧の時代順表示 → component（Sidebar.test.tsx）/ URL への反映 → component（App.test.tsx）
  # E2E で扱わない: 不正な直リンクのフォールバック・切替時の選択クリア → component（App.test.tsx）

  Background:
    Given アプリを開いている

  Scenario: テーマを選択するとマーカーが表示される
    When テーマ「古代オリエント」を選択する
    Then 都市マーカー「バビロン」が表示されている
    And 地形ラベル「ユーフラテス川」が表示されている

  Scenario: テーマ直リンクを開くと選択済みの状態になる
    Given クエリ「?theme=ancient-greece」でアプリを開いている
    Then 都市マーカー「アテネ」が表示されている

  Scenario: テーマを切り替えると前のテーマのマーカーが消える
    When テーマ「古代オリエント」を選択する
    And テーマ「古代ギリシア」を選択する
    Then 都市マーカー「アテネ」が表示されている
    And 都市マーカー「バビロン」が表示されていない
