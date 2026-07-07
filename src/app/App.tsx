import { MapView } from '../map/MapView';

export function App() {
  return (
    <div className="h-dvh w-dvw">
      <h1 className="sr-only">世界史マップ</h1>
      <MapView colorTheme="light" />
    </div>
  );
}
