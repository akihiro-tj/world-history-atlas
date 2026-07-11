# カラーテーマ Test Plan

## Application Overview

カラーテーマの選択はブラウザのリロードをまたいで維持される（localStorage 永続化の実往復）。

## Test Scenarios

### 1. 永続化

**Seed:** `e2e/seed.spec.ts`

#### 1.1. persists-across-reload

**File:** `e2e/color-theme/persists-across-reload.spec.ts`

**Steps:**
  1. `/` を開き、カラーテーマトグルをクリックする
    - expect: `html` の `data-color-theme` が `dark`
  2. ページをリロードする
    - expect: `html` の `data-color-theme` が `dark`
