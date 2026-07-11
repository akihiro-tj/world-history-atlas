# モバイル表示 Test Plan

## Application Overview

モバイル実ビューポートで、ドロワーからのテーマ選択と、解説のボトムシート表示（画面下半分）を守る。

## Test Scenarios

### 1. モバイル `@mobile`

**Seed:** `e2e/seed.spec.ts`

#### 1.1. drawer-select-shows-markers

**File:** `e2e/mobile/drawer-select-shows-markers.spec.ts`

**Steps:**
  1. `/` を開き、ドロワーからテーマ「古代オリエント」を選択する
    - expect: 都市マーカー「バビロン」が表示される

#### 1.2. detail-bottom-sheet

**File:** `e2e/mobile/detail-bottom-sheet.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」を選択し、都市マーカー「バビロン」をクリックする
    - expect: 解説パネルが表示される
    - expect: 解説パネルの上端 y が画面高さの半分より下にある
