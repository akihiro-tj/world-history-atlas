# 解説パネル Test Plan

## Application Overview

実マップ上のマーカー／地形ラベルをクリックすると解説パネルが開き、名称・解説文・頻出度が表示される。

## Test Scenarios

### 1. 解説表示

**Seed:** `e2e/seed.spec.ts`

#### 1.1. marker-opens-panel

**File:** `e2e/feature-detail/marker-opens-panel.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」を選択し、都市マーカー「バビロン」をクリックする
    - expect: 解説パネルに「バビロン」が表示される
    - expect: 解説パネルに「メソポタミア」が表示される
    - expect: 解説パネルに「★1」が表示される

#### 1.2. terrain-opens-panel

**File:** `e2e/feature-detail/terrain-opens-panel.spec.ts`

**Steps:**
  1. `/` を開き、テーマ「古代オリエント」を選択し、地形ラベル「ユーフラテス川」をクリックする
    - expect: 解説パネルに「ユーフラテス川」が表示される
