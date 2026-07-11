# アプリ起動 Test Plan

## Application Overview

アプリを開くと実 MapLibre 地図が描画される。地図は jsdom で動かないため E2E スモークで守る。

## Test Scenarios

### 1. 起動

**Seed:** `e2e/seed.spec.ts`

#### 1.1. map-renders `@smoke`

**File:** `e2e/app-boot/map-renders.spec.ts`

**Steps:**
  1. `/` を開く
    - expect: `map-view`（testid）が表示される
    - expect: `.maplibregl-canvas` が表示される
