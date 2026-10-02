/// <reference types="vite/client" />

declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import type { Loader, LoadingManager, Group } from 'three';
  import type { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    setDRACOLoader(dracoLoader: DRACOLoader): this;
    load(
      url: string,
      onLoad: (gltf: { scene: Group }) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void
    ): void;
  }
}

declare module 'three/examples/jsm/loaders/DRACOLoader' {
  import type { Loader, LoadingManager } from 'three';
  export class DRACOLoader extends Loader {
    constructor(manager?: LoadingManager);
    setDecoderPath(path: string): this;
    setDecoderConfig(config: { type?: string }): this;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/environments/RoomEnvironment' {
  import { Scene } from 'three';
  export class RoomEnvironment extends Scene {
    constructor();
    dispose(): void;
  }
}

declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}

declare module 'qrcode-generator' {
  interface QRCode {
    addData(data: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
  }
  export default function qrcode(typeNumber: number, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'): QRCode;
}
