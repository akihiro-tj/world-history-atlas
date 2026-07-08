import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapView } from './MapView';
import { BASEMAP_SOURCE_ID } from './mapStyle';

type Handler = (...args: unknown[]) => void;
type FakeMap = { handlers: Map<string, Handler> };

const { fakeMapInstances } = vi.hoisted(() => ({
  fakeMapInstances: [] as FakeMap[],
}));

vi.mock('maplibre-gl', () => {
  class FakeMaplibreMap {
    handlers = new globalThis.Map<string, Handler>();
    constructor() {
      fakeMapInstances.push(this);
    }
    on(event: string, handler: Handler) {
      this.handlers.set(event, handler);
    }
    off(event: string) {
      this.handlers.delete(event);
    }
    setStyle() {}
    remove() {}
  }
  return { default: { Map: FakeMaplibreMap, addProtocol: vi.fn() } };
});

vi.mock('pmtiles', () => ({
  Protocol: class {
    tile = vi.fn();
    tiles = new globalThis.Map();
  },
}));

beforeEach(() => {
  fakeMapInstances.length = 0;
});

describe('MapView', () => {
  it('basemap ソースのエラーで onError を呼ぶ', () => {
    const onError = vi.fn();
    render(
      <MapView
        colorTheme="light"
        basemapPath="/tiles/basemap.pmtiles"
        onError={onError}
      />,
    );
    const map = fakeMapInstances.at(-1);
    map?.handlers.get('error')?.({
      error: { message: 'network error' },
      sourceId: BASEMAP_SOURCE_ID,
    });
    expect(onError).toHaveBeenCalledWith('地図の読み込みに失敗しました');
  });

  it('basemap 以外のソースのエラーでは onError を呼ばない', () => {
    const onError = vi.fn();
    render(
      <MapView
        colorTheme="light"
        basemapPath="/tiles/basemap.pmtiles"
        onError={onError}
      />,
    );
    const map = fakeMapInstances.at(-1);
    map?.handlers.get('error')?.({
      error: { message: 'some other error' },
      sourceId: 'unrelated-source',
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('sourceId のない一般的なエラーでは onError を呼ばない', () => {
    const onError = vi.fn();
    render(
      <MapView
        colorTheme="light"
        basemapPath="/tiles/basemap.pmtiles"
        onError={onError}
      />,
    );
    const map = fakeMapInstances.at(-1);
    map?.handlers.get('error')?.({ error: { message: 'boom' } });
    expect(onError).not.toHaveBeenCalled();
  });
});
