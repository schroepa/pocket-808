/** Aufnahme über das Mikrofon (Legacy recToggle): MediaRecorder, Höchstdauer, Mikrofon wieder frei. */

export interface MediaRecorderLike {
  start(): void;
  stop(): void;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
}

export interface RecorderEnv {
  mediaDevices?: { getUserMedia(c: MediaStreamConstraints): Promise<MediaStream> } | undefined;
  MediaRecorder?: (new (stream: MediaStream) => MediaRecorderLike) | undefined;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type RecordStart =
  { done: Promise<ArrayBuffer | null>; stop(): void } | { error: 'unavailable' | 'denied' };

export function createRecorder(env: RecorderEnv): { start(maxMs: number): Promise<RecordStart> } {
  return {
    async start(maxMs) {
      const Rec = env.MediaRecorder;
      if (!env.mediaDevices || !Rec) return { error: 'unavailable' };
      let stream: MediaStream;
      try {
        stream = await env.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return { error: 'denied' };
      }
      const chunks: Blob[] = [];
      const release = (): void => {
        for (const t of stream.getTracks()) t.stop();
      };
      let mr: MediaRecorderLike;
      try {
        mr = new Rec(stream);
      } catch {
        release();
        return { error: 'unavailable' };
      }
      mr.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      const done = new Promise<ArrayBuffer | null>((resolve) => {
        mr.onstop = () => {
          env.clearTimeout(timer);
          release();
          // ein Lesefehler zählt wie „nichts aufgenommen“, der Knopf darf nicht hängen bleiben
          resolve(chunks.length ? new Blob(chunks).arrayBuffer().catch(() => null) : null);
        };
      });
      try {
        mr.start();
      } catch {
        release();
        return { error: 'unavailable' };
      }
      const timer = env.setTimeout(() => {
        mr.stop();
      }, maxMs);
      return {
        done,
        stop: () => {
          mr.stop();
        },
      };
    },
  };
}
