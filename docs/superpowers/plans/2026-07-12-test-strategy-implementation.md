# テスト戦略実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設計スペック（docs/superpowers/specs/2026-07-12-test-strategy-design.md）を実装する。E2E を 2 基準（技術・価値）の 9 カタログに絞り、.feature を唯一の定常レビュー対象とする運用（GUIDELINE）を整備し、E2E から下ろした振る舞いと組み合わせギャップを component テストで担保する。

**Architecture:** playwright-bdd（既存）の .feature + steps 構成は維持。変更は「.feature の書き換え（冒頭コメントに軸と扱わない観点）・不要シナリオ/ステップの削除・GUIDELINE 新設・component テスト増強・CLAUDE.md 更新」。

**Tech Stack:** Vitest / React Testing Library（jsdom）、Playwright + playwright-bdd（bddgen）。

## Global Constraints

- ブランチ `test/e2e-spec-workflow` で作業する。**push・PR 作成はユーザー承認後**
- コミットメッセージは英語 Conventional Commits。UI 文言・ドキュメントは日本語。コード内コメントは Why / Warning のみ英語
- E2E に置いた振る舞いは component に書かない（二重テスト禁止）。分岐・変形は component / unit
- シナリオ文は既存ステップ語彙のみ。`bddgen` が語彙外を検出して失敗することが機械検査
- サンドボックス内では dev サーバ（localhost バインド）不可。`pnpm e2e` はコントローラがサンドボックス無効で実行する。タスク内の検証ゲートは typecheck / lint / vitest / `npx bddgen`（生成のみ）まで

---

### Task 1: E2E 作成ガイドライン

**Files:**
- Create: `e2e/GUIDELINE.md`

**Interfaces:**
- Produces: AI が .feature を書くときに従う手順書。Task 3 のシナリオ書き換えはこの書式に従う

- [ ] **Step 1: GUIDELINE.md を作成する**

```markdown
# E2E テスト作成ガイドライン

AI が `.feature` を作成・更新するときの手順と規約。`.feature` が一次情報であり、人間がレビューする唯一の定常対象。戦略の根拠は docs/superpowers/specs/2026-07-12-test-strategy-design.md。

## 観点の導出手順

1. 対象機能の状態の軸（状態変数とその値域）を列挙する
2. 6 カテゴリを順に当てて観点を出す
   1. 状態の単体（loading / error / empty / success）
   2. 状態の組み合わせ（変更した状態 × 既存の状態）
   3. 派生状態の追従（導出される表示が元の状態の変化に追従するか）
   4. 境界値
   5. エラー経路と回復
   6. 永続化・リロード
3. 各観点を E2E の境界で判定する
   - 技術基準: 実 MapLibre の描画・実ビューポートのレイアウト・実リロードを要する
   - 価値基準: 壊れたら学習体験が成立しないコアフロー（少数を明示して維持する）
   - E2E に置く観点だけをシナリオ化し、置かない観点は Feature 冒頭コメントに担保先とともに記録する
4. シナリオ文は既存のステップ語彙のみで書く。語彙は `npx bddgen export` で確認する

## .feature の書式

- Feature 冒頭のコメントに「軸:」と「E2E で扱わない: 観点 → 担保先」を書く
- タグ: スモークは `@smoke`、モバイル専用は `@mobile`、未実装は `@wip`
- 記法: 英語キーワード（Feature / Scenario / Given / When / Then）+ 日本語本文
- アサーションは「〜されている」（状態）、操作は「〜する」（動作）で統一する
- `「」` 内の引数を取るステップは正規表現で定義する（`{string}` は使わない）
- 表記ゆれ禁止。既存語彙を再利用し、同義の新しい言い回しを作らない

## ステップ語彙を増やすとき

- 新しい UI 操作・検証が必要な場合のみ `e2e/steps/` に追加する
- 追加・変更の diff は人間が検収する。見る点は 3 つ
  1. 文と実装の意味が一致しているか（「表示されている」が可視性を検証しているか等）
  2. ロケータが正しい対象を指しているか（誤ると、そのステップを使う全シナリオが違うものを検証して green になる）
  3. 否定形・待機の実装が適切か（「表示されていない」= 消えるまで待つ `toHaveCount(0)` か、即時の `not.toBeVisible()` か）
- ロケータは role / アクセシブルネーム / `data-*` を優先し、CSS クラスや可変テキストに依存しない

## レビューの分担

- 毎回: `.feature` の diff（観点の抜け・期待挙動の正しさ・「扱わない」判断）
- 語彙の増減時のみ: ステップ定義の diff（上記 3 点）
- 下位層（component / unit）のテストコードは定常の精読対象にしない
```

- [ ] **Step 2: コミット**

```bash
git add e2e/GUIDELINE.md
git commit -m "docs(e2e): add test authoring guideline"
```

---

### Task 2: component テストの増強（DEMOTE + 組み合わせギャップ）

E2E から下ろすカラーテーマ 2 件と、選択×フィルタ・テーマ切替の組み合わせ 4 件を `App.test.tsx` に追加する。**すべて既存挙動の backfill であり、初回から green になる**（red-green ではない。アプリコードは変更しない。通らない場合はテスト側を実挙動に合わせ、合わせられないときは BLOCKED で報告）。

**Files:**
- Modify/Test: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: 既存モック（MapView / FeatureMarkers / manifest / fetch）。`FeatureMarkers` モックは `marker-<id>` の testid でボタンを描画する。`ImportanceFilterControl` は実物が描画され、`selection.status === 'loaded'` のときだけ表示される（`src/app/App.tsx:327`）。テーマ切替は選択を即時クリアする（`src/app/App.tsx:112`）

- [ ] **Step 1: テーマフィクスチャに ★2 都市を追加する**

`fetchTheme` モック（`src/app/App.test.tsx` 内）の `features` 配列に、babylon の後へ追加:

```tsx
              {
                id: 'ur',
                kind: 'city',
                name: 'ウル',
                coordinates: [46.103, 30.963],
                importance: 2,
                description: '解説。',
              },
```

- [ ] **Step 2: テストを追加する**

ファイル末尾（`describe('App', ...)` の閉じ括弧の後）に sibling として追加。使用する識別子はすべて既存 import で足りる:

```tsx
describe('カラーテーマ', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-color-theme');
  });

  it('トグルで data-color-theme が dark になる', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /古代オリエント/ });
    await userEvent.click(
      screen.getByRole('button', { name: 'カラーテーマを切り替える' }),
    );
    expect(document.documentElement).toHaveAttribute(
      'data-color-theme',
      'dark',
    );
  });

  it('OS がダークなら初期表示が dark になる', async () => {
    const restoreMatchMedia = window.matchMedia;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    try {
      render(<App />);
      await screen.findByRole('button', { name: /古代オリエント/ });
      expect(document.documentElement).toHaveAttribute(
        'data-color-theme',
        'dark',
      );
    } finally {
      vi.stubGlobal('matchMedia', restoreMatchMedia);
    }
  });
});

describe('選択とフィルタ・テーマ切替の組み合わせ', () => {
  async function renderAndSelectOrient() {
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: /古代オリエント/ }),
    );
  }

  it('選択中の★2都市が★1のみフィルタで消えると解説パネルも閉じる', async () => {
    await renderAndSelectOrient();
    await userEvent.click(await screen.findByTestId('marker-ur'));
    expect(await screen.findByTestId('detail-panel')).toHaveTextContent('ウル');

    await userEvent.click(screen.getByRole('button', { name: '★1のみ' }));

    expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marker-ur')).not.toBeInTheDocument();
  });

  it('選択中の★1都市は★1のみフィルタでも解説パネルが残る', async () => {
    await renderAndSelectOrient();
    await userEvent.click(await screen.findByTestId('marker-babylon'));
    expect(await screen.findByTestId('detail-panel')).toHaveTextContent(
      'バビロン',
    );

    await userEvent.click(screen.getByRole('button', { name: '★1のみ' }));

    expect(screen.getByTestId('detail-panel')).toHaveTextContent('バビロン');
  });

  it('テーマを切り替えると解説パネルが閉じる', async () => {
    await renderAndSelectOrient();
    await userEvent.click(await screen.findByTestId('marker-babylon'));
    expect(await screen.findByTestId('detail-panel')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /壊れたテーマ/ }));

    expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();
  });

  it('テーマを切り替えてもフィルタ設定は維持される', async () => {
    await renderAndSelectOrient();
    await userEvent.click(screen.getByRole('button', { name: '★1のみ' }));
    expect(screen.queryByTestId('marker-ur')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /壊れたテーマ/ }));
    await userEvent.click(
      screen.getByRole('button', { name: /古代オリエント/ }),
    );

    expect(await screen.findByTestId('marker-babylon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '★1のみ' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByTestId('marker-ur')).not.toBeInTheDocument();
  });
});
```

注記: 最後のテストは現状挙動（テーマ切替でフィルタが維持される）を固定する。これが仕様として正しいかは PR レビューで判断し、変える場合は別途アプリ側を修正する（PR description に明記すること）。

- [ ] **Step 3: 実行して green を確認する**

Run: `pnpm vitest run src/app/App.test.tsx`
Expected: 全 PASS・出力 pristine（既存 + 新規 6 件）

- [ ] **Step 4: コミット**

```bash
git add src/app/App.test.tsx
git commit -m "test(app): cover color theme and selection interaction behaviors"
```

---

### Task 3: .feature の書き換えとステップの整理

7 つの .feature を「2 基準の 9 カタログ + 冒頭コメント（軸・扱わない観点）」に書き換え、不要になったステップ定義と、E2E に昇格したエラー回復の重複 component テストを削除する。

**Files:**
- Modify: `e2e/features/app-boot.feature`, `theme-selection.feature`, `feature-detail.feature`, `importance-filter.feature`, `color-theme.feature`, `error-handling.feature`, `mobile.feature`
- Modify: `e2e/steps/theme.steps.ts`, `e2e/steps/detail.steps.ts`, `e2e/steps/color-theme.steps.ts`, `e2e/steps/error.steps.ts`
- Modify: `src/app/App.test.tsx`（重複テスト 1 件削除）

**Interfaces:**
- Consumes: 既存ステップ語彙（削除する 4 件を除き変更しない）

- [ ] **Step 1: 各 .feature を以下の内容へ全置換する**

`e2e/features/app-boot.feature`:

```gherkin
@smoke
Feature: アプリの起動
  # 軸: なし（起動の単一状態）
  # E2E で扱わない: WebGL2 非対応の案内 → component（App.test.tsx）

  Scenario: 地図が表示される
    Given アプリを開いている
    Then 地図が表示されている
```

`e2e/features/theme-selection.feature`:

```gherkin
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
```

`e2e/features/feature-detail.feature`:

```gherkin
Feature: フィーチャーの解説表示
  # 軸: フィーチャー種別 = 都市 / 地形
  # E2E で扱わない: パネルを閉じる（ボタン・地図余白クリック・ドロワー連動）→ component（App.test.tsx / DetailPanel.test.tsx）

  Background:
    Given アプリを開いている
    And テーマ「古代オリエント」を選択している

  Scenario: 都市マーカーをクリックすると解説パネルが表示される
    When 都市マーカー「バビロン」をクリックする
    Then 解説パネルに「バビロン」と表示されている
    And 解説パネルに「メソポタミア」を含む解説文が表示されている
    And 解説パネルに頻出度「★1」が表示されている

  Scenario: 地形ラベルをクリックしても解説パネルが表示される
    When 地形ラベル「ユーフラテス川」をクリックする
    Then 解説パネルに「ユーフラテス川」と表示されている
```

`e2e/features/importance-filter.feature`:

```gherkin
Feature: 頻出度フィルタ
  # 軸: フィルタ = ★1のみ / ★1〜2 / すべて × 選択中 = なし / ★1都市 / ★2都市 / 地形
  # E2E で扱わない: 選択中フィーチャーとの組み合わせ（フィルタで消える・残る、切替後の維持）→ component（App.test.tsx）
  # E2E で扱わない: 絞り込みロジックの境界 → unit（filter.test.ts）

  Background:
    Given アプリを開いている
    And テーマ「古代オリエント」を選択している

  Scenario Outline: フィルタで対象の頻出度だけが表示される
    When 頻出度フィルタを「<フィルタ>」に切り替える
    Then 都市マーカー「<表示される>」が表示されている
    And 都市マーカー「<表示されない>」が表示されていない

    Examples:
      | フィルタ | 表示される | 表示されない |
      | ★1のみ   | バビロン   | ウル         |
      | ★1〜2    | ウル       | ウルク       |

  Scenario: フィルタを「すべて」に戻すと全フィーチャーが表示される
    Given 頻出度フィルタを「★1のみ」に切り替える
    When 頻出度フィルタを「すべて」に切り替える
    Then 都市マーカー「ウルク」が表示されている
```

`e2e/features/color-theme.feature`:

```gherkin
Feature: カラーテーマ切替
  # 軸: 初期値 = OS 設定 / 保存値 × 操作 = トグル / リロード
  # E2E で扱わない: トグルの DOM 反映・OS 設定追従 → component（App.test.tsx）/ 初期値の解決ロジック → unit（colorTheme.test.ts）

  Scenario: 選択したカラーテーマはリロード後も維持される
    Given アプリを開いている
    And カラーテーマトグルをクリックする
    When ページをリロードする
    Then ダークテーマが適用されている
```

`e2e/features/error-handling.feature`:

```gherkin
Feature: エラー処理
  # 価値基準: データを表示できない学習アプリは成立しないため、回復の代表フローを E2E に置く
  # 軸: 失敗対象 = テーマデータ / マニフェスト / 地図タイル
  # E2E で扱わない: マニフェスト取得失敗・クリック由来の読み込み失敗・不正な直リンクなどの変形 → component（App.test.tsx）

  Scenario: データ取得に失敗するとエラーが表示され、再試行で回復できる
    Given テーマデータの取得が失敗する状態である
    And アプリを開いている
    Then エラーメッセージ「データの取得に失敗しました」が表示されている
    And 再試行ボタンが表示されている
    When データ取得を正常に戻す
    And 再試行ボタンをクリックする
    Then サイドバーにテーマ「古代オリエント」が表示されている
```

`e2e/features/mobile.feature`:

```gherkin
@mobile
Feature: モバイル表示
  # 軸: ビューポート = モバイル × 操作 = ドロワーからの選択 / 解説の表示
  # E2E で扱わない: ドロワー開閉状態・inert・ドロワーと解説パネルの連動 → component（App.test.tsx）

  Scenario: ドロワーからテーマを選択できる
    Given アプリを開いている
    When メニューボタンでドロワーを開く
    And テーマ「古代オリエント」を選択する
    Then 都市マーカー「バビロン」が表示されている

  Scenario: 解説はボトムシートで表示される
    Given アプリを開いている
    And テーマ「古代オリエント」を選択している
    When 都市マーカー「バビロン」をクリックする
    Then 解説パネルが画面の下半分に表示されている
```

- [ ] **Step 2: 不要になったステップ定義を削除する**

どの .feature からも参照されなくなった 4 件を削除（デッドコード）:

- `e2e/steps/theme.steps.ts`: `URL のクエリが「(.+)」を含んでいる` の Then ブロック
- `e2e/steps/detail.steps.ts`: `解説パネルの閉じるボタンをクリックする` の When と `解説パネルが表示されていない` の Then
- `e2e/steps/color-theme.steps.ts`: `OS のカラースキームがダークである` の Given
- `e2e/steps/error.steps.ts`: `テーマ選択を促すメッセージが表示されている` の Then

- [ ] **Step 3: E2E に昇格した重複 component テストを削除する**

`src/app/App.test.tsx` から `it('テーマ一覧の取得失敗でエラービューが出て、再試行で回復する', ...)` のテストブロック全体を削除する（エラー回復の代表フローは E2E が担保。manifest 失敗などの変形テストは残す）。

- [ ] **Step 4: 検証**

Run:
```bash
npx bddgen
pnpm typecheck
pnpm lint
pnpm vitest run
```
Expected: bddgen が語彙エラーなしで生成完了。typecheck / lint clean。vitest 全 PASS。

- [ ] **Step 5: コミット**

```bash
git add e2e/features e2e/steps src/app/App.test.tsx
git commit -m "test(e2e): scope features to the two-criteria boundary and prune steps"
```

---

### Task 4: CLAUDE.md の E2E 節を更新する

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: セクションを置換する**

`## E2E テスト仕様書（e2e/features/）` から次の `## データ作成` 見出しの直前までを、以下で全置換する（旧内容のステップ語彙一覧は `bddgen export` で代替されるため削除）:

```markdown
## E2E テスト仕様書（e2e/features/）

- `.feature` が一次情報で、人間がレビューする唯一の定常対象。機能の追加・変更は「AI が e2e/GUIDELINE.md に従って .feature を差分更新 → 人間が diff をレビュー → bddgen が語彙を機械検査 → CI」の順で進める
- E2E の境界は 2 基準: ①jsdom で検証できないもの（実 MapLibre 描画・実ビューポートのレイアウト・実リロード）②壊れたら学習体験が成立しないコアフロー（少数を明示）。E2E に置いた振る舞いは component に書かず、同じ機能の分岐・変形を component / unit に置く
- シナリオ文は既存ステップ語彙のみで書く（語彙は `npx bddgen export` で確認）。新しい操作が必要なときだけステップ定義を追加し、その diff は人間が検収する
- 書式・観点導出・検収の観点は e2e/GUIDELINE.md、戦略の根拠は docs/superpowers/specs/2026-07-12-test-strategy-design.md
```

- [ ] **Step 2: 検証とコミット**

Run: `pnpm lint`
Expected: clean

```bash
git add CLAUDE.md
git commit -m "docs: align CLAUDE.md E2E workflow with the guideline"
```

---

### Task 5: 全体検証（コントローラ実施）

- [ ] **Step 1: 非ブラウザ検証（サンドボックス内）**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: すべて green

- [ ] **Step 2: E2E 実行（サンドボックス無効・要ローカルブラウザ）**

Run: `pnpm e2e`
Expected: desktop 11 tests（Outline 2 例 + すべて戻し + 起動 + テーマ 3 + 解説 2 + カラー 1 + エラー 1）+ mobile 2 tests、全 PASS

- [ ] **Step 3: push と PR 作成はユーザー承認後**

PR description に「テーマ切替後のフィルタ維持は現状挙動を固定。仕様として正しいかは要判断」を明記する。

---

## Self-Review

- **Spec coverage:** 2 基準の境界 → .feature 冒頭コメント + カタログ 9 行（Task 3。エラー回復が価値基準）。E2E ⇔ component の粒度分担 → Task 2 追加 + Task 3 Step 3 削除。GUIDELINE → Task 1。レビュー 2 種類・語彙運用 → GUIDELINE / CLAUDE.md。二重テスト禁止 → 各 feature の「扱わない」コメントと重複テスト削除
- **Placeholder scan:** 全ステップに実コード・実コマンドあり
- **Type consistency:** 追加テストが使う識別子（`render` / `screen` / `userEvent` / `vi` / `afterEach` / testid `marker-ur` / ラベル `★1のみ` / `壊れたテーマ`）はすべて既存の App.test.tsx モック・実コンポーネントの値と一致。フィクスチャ追加（ウル importance 2）は Task 2 Step 1 で定義し、importance-filter.feature の実データ（ウル ★2・ウルク ★3、public/data/themes/ancient-orient.json）とは独立
- **リスク:** G3（フィルタ維持）は現状挙動の固定であり仕様判断が未決 → PR description に明記（Task 5）
