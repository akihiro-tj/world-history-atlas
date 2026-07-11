# テーマ選択 Test Plan

## Application Overview

テーマを選ぶと実マップ上に都市マーカー・地形ラベルが描画される。直リンクで開くと選択済みになり、テーマを切り替えると前テーマのマーカーは消える。

## Test Scenarios

### 1. テーマ選択

**Seed:** `e2e/seed.spec.ts`

#### 1.1. select-shows-markers

**File:** `e2e/theme-selection/select-shows-markers.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」を選択する
    - expect: 都市マーカー「バビロン」が表示される
    - expect: 地形ラベル「ユーフラテス川」が表示される

#### 1.2. direct-link-preselected

**File:** `e2e/theme-selection/direct-link-preselected.spec.ts`

**Steps:**
  1. `/?theme=ancient-greece` を開く
    - expect: 都市マーカー「アテネ」が表示される

#### 1.3. switch-clears-previous

**File:** `e2e/theme-selection/switch-clears-previous.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」→「古代ギリシア」の順に選択する
    - expect: 都市マーカー「アテネ」が表示される
    - expect: 都市マーカー「バビロン」が表示されない
