declare module "@ffmpeg/ffmpeg" {
  export class FFmpeg {
    loaded: boolean;
    on(event: "log", callback: (data: { type: string; message: string }) => void): void;
    on(
      event: "progress",
      callback: (data: { progress: number; time: number }) => void
    ): void;
    off(event: "log", callback: (data: unknown) => void): void;
    off(event: "progress", callback: (data: unknown) => void): void;
    load(config?: { coreURL?: string; wasmURL?: string; workerURL?: string }): Promise<void>;
    exec(args: string[]): Promise<number>;
    writeFile(path: string, data: Uint8Array | string): Promise<void>;
    readFile(path: string): Promise<Uint8Array>;
    readFile(path: string, encoding: "utf8"): Promise<string>;
    unlink(path: string): Promise<void>;
    listDir(path: string): Promise<{ name: string; isFile: boolean }[]>;
    createDir(path: string): Promise<void>;
    deleteFile(path: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    terminate(): Promise<void>;
  }
}

declare module "@ffmpeg/util" {
  export function fetchFile(
    url: string,
    options?: { rangeStart?: number; rangeEnd?: number }
  ): Promise<Uint8Array>;
}
