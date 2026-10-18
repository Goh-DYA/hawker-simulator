/**
 * The debounced, serialised autosave queue behind the game screen.
 *
 * Persistent changes are coalesced: each `schedule` replaces the pending payload and
 * restarts the debounce, and only the last payload is written. Writes run one at a time,
 * in call order, and a failed write does not block the next one. Only the latest write
 * reports its outcome, so an older write that settles late cannot overwrite the status of
 * a newer one. The queue is independent of React and IndexedDB: the caller supplies the
 * write, the status and error callbacks, and the timer functions.
 */

/** The autosave state the HUD shows. */
export type AutosaveStatus = "saving" | "saved" | "error";

/** What {@link create_autosave} needs from its caller. */
export interface AutosaveOptions<TimerHandle> {
  /** Writes one payload to storage; rejects when the write fails. */
  write(payload: unknown): Promise<void>;
  /** Receives every status change. */
  onStatus(status: AutosaveStatus): void;
  /** Receives every failed write, before {@link Autosave.save} rejects. */
  onError(error: unknown): void;
  /** The debounce between the last scheduled change and its write. */
  delayMs?: number;
  /** Starts the debounce timer. */
  setTimer(callback: () => void, delay_ms: number): TimerHandle;
  /** Stops a debounce timer; it receives `undefined` when no timer has started. */
  clearTimer(handle: TimerHandle | undefined): void;
}

/** The autosave queue returned by {@link create_autosave}. */
export interface Autosave {
  /** Makes `payload` the pending save and restarts the debounce. */
  schedule(payload: unknown): void;
  /** Writes the pending save now, if there is one. Never rejects. */
  flush(): Promise<void>;
  /**
   * Queues a write of `payload`. When the write fails it logs the failure, then rejects
   * with an `Error("Local save failed")` whose `cause` is the write's error.
   */
  save(payload: unknown): Promise<void>;
  /** Stops the debounce and drops the pending save. */
  cancel(): void;
  /** Resolves once every queued write has settled, whether it failed or not. */
  settle(): Promise<unknown>;
}

/** The default debounce between the last persistent change and its write. */
const DEFAULT_AUTOSAVE_DELAY_MS = 200;

/**
 * Create a debounced, serialised autosave queue.
 *
 * @param options - The write, the status and error callbacks, the debounce and the timer
 * functions.
 * @returns The queue's controls.
 */
export function create_autosave<TimerHandle>({
  write,
  onStatus,
  onError,
  delayMs = DEFAULT_AUTOSAVE_DELAY_MS,
  setTimer,
  clearTimer,
}: AutosaveOptions<TimerHandle>): Autosave {
  let timer: TimerHandle | undefined;
  let pending_payload: unknown = undefined;
  let queue: Promise<void> = Promise.resolve();
  let sequence = 0;

  async function save(payload: unknown): Promise<void> {
    const write_sequence = ++sequence;
    onStatus("saving");
    const operation = queue.catch(() => undefined).then(() => write(payload));
    queue = operation;
    try {
      await operation;
      if (write_sequence === sequence) onStatus("saved");
    } catch (error) {
      console.warn("[autosave] write failed", error);
      if (write_sequence === sequence) onStatus("error");
      onError(error);
      // The import flow shows this message to the player, so it stays as it was.
      throw new Error("Local save failed", { cause: error });
    }
  }

  async function flush(): Promise<void> {
    clearTimer(timer);
    const payload = pending_payload;
    if (payload === undefined) return;
    pending_payload = undefined;
    await save(payload).catch(() => undefined);
  }

  function schedule(payload: unknown): void {
    pending_payload = payload;
    clearTimer(timer);
    onStatus("saving");
    timer = setTimer(() => {
      void flush();
    }, delayMs);
  }

  function cancel(): void {
    clearTimer(timer);
    pending_payload = undefined;
  }

  function settle(): Promise<unknown> {
    return queue.catch(() => undefined);
  }

  return { schedule, flush, save, cancel, settle };
}
