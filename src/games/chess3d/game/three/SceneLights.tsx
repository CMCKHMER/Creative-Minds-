
import { Environment, Lightformer } from "@react-three/drei";

/**
 * - studio: warm key, cool rim and an offline studio environment (lobby showcase, gallery)
 * - outdoor: golden-hour sun with sky/meadow bounce light for the battlefield
 */
export function SceneLights({ shadowSize = 2048, variant = "studio" }: { shadowSize?: number; variant?: "studio" | "outdoor" }) {
  if (variant === "outdoor") {
    return (
      <>
        <ambientLight intensity={0.3} color="#fff2df" />
        <hemisphereLight args={["#c4dcff", "#5d7a35", 1.05]} />
        <directionalLight
          position={[9, 11, 6]}
          intensity={3.1}
          color="#ffe0b0"
          castShadow
          shadow-mapSize={[shadowSize, shadowSize]}
          shadow-camera-left={-10.5}
          shadow-camera-right={10.5}
          shadow-camera-top={10.5}
          shadow-camera-bottom={-10.5}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
        />
        <directionalLight position={[-9, 6, -8]} intensity={0.75} color="#a9c4ff" />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={4} position={[0, 7, 6]} scale={[12, 4, 1]} color="#fff0d6" />
          <Lightformer form="rect" intensity={2.6} position={[-8, 3, 0]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} color="#bcd4ff" />
          <Lightformer form="rect" intensity={2.6} position={[8, 3, 0]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} color="#ffd3a0" />
          <Lightformer form="rect" intensity={1.6} position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} color="#6f8f3c" />
          <Lightformer form="circle" intensity={2.4} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={8} color="#e8f1ff" />
        </Environment>
      </>
    );
  }
  return (
    <>
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#c3d4ff", "#3a2a1c", 0.55]} />
      <directionalLight
        position={[6, 12, 7]}
        intensity={2.6}
        color="#fff0d2"
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={34}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[-9, 6, -7]} intensity={1.0} color="#8fb0ff" />
      <directionalLight position={[9, 5, -8]} intensity={0.6} color="#ffb98a" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={5} position={[0, 7, 6]} scale={[12, 4, 1]} color="#fff4e0" />
        <Lightformer form="rect" intensity={3} position={[-8, 3, 0]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} color="#b8ccff" />
        <Lightformer form="rect" intensity={3} position={[8, 3, 0]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} color="#ffd9b0" />
        <Lightformer form="rect" intensity={2} position={[0, 4, -8]} rotation-y={Math.PI} scale={[12, 4, 1]} color="#ffffff" />
        <Lightformer form="circle" intensity={2} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={8} color="#ffffff" />
      </Environment>
    </>
  );
}
