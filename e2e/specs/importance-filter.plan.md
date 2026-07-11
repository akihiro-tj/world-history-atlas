# 頻出度フィルタ Test Plan

## Application Overview

頻出度フィルタの切替が実マップのマーカー表示に反映される。解説パネルを開いたままでもフィルタを操作できる。

## Test Scenarios

### 1. フィルタ

**Seed:** `e2e/seed.spec.ts`

#### 1.1. filter-changes-markers

**File:** `e2e/importance-filter/filter-changes-markers.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」を選択する
  2. 頻出度フィルタを「★1のみ」に切り替える
    - expect: 都市マーカー「バビロン」が表示される
    - expect: 都市マーカー「ウル」が表示されない
  3. 頻出度フィルタを「すべて」に切り替える
    - expect: 都市マーカー「ウルク」が表示される
  4. 都市マーカー「バビロン」をクリックし、頻出度フィルタを「★1のみ」に切り替える
    - expect: 解説パネルに「バビロン」が表示される
    - expect: 都市マーカー「ウル」が表示されない
