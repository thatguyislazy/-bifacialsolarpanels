export default function ControlsPanel({ thickness, setThickness }) {
  return (
    <div className="panel">
      <h3>Green Wall Thickness</h3>
      <input
        type="range"
        min="0"
        max="200"
        value={thickness}
        onChange={(e) => setThickness(e.target.value)}
      />
      <p>{thickness} mm</p>
    </div>
  );
}