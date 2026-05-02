import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function Model() {
  const { scene } = useGLTF("/model/building.glb");
  return <primitive object={scene} scale={1.5} />;
}

export default function ThreeScene() {
  return (
    <Canvas camera={{ position: [5, 5, 5] }}>
      <ambientLight intensity={1} />
      <directionalLight position={[5, 5, 5]} />
      <Model />
      <OrbitControls />
    </Canvas>
  );
}