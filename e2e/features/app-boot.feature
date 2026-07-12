@smoke
Feature: アプリの起動
  # 軸: なし（起動の単一状態）
  # E2E で扱わない: WebGL2 非対応の案内 → component（App.test.tsx）

  Scenario: 地図が表示される
    Given アプリを開いている
    Then 地図が表示されている
