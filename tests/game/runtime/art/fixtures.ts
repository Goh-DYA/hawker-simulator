/**
 * Test helpers for the Phaser-free painters in `runtime/art/`: a recording paint context that
 * logs every method call and property assignment, so a painter's exact output can be digested
 * and compared without a canvas.
 */
import { createHash } from "node:crypto";

import type { PaintContext } from "@/src/game/runtime/art/canvas";
import { plan_texture } from "@/src/game/runtime/art/index";
import type { PaintSpec } from "@/src/game/runtime/art/specs";

import { format_render_value } from "../fixtures";

/** A recording paint context and the log it writes to. */
export interface RecordingContext {
  readonly ctx: PaintContext;
  /** The recorded calls, one JSON array per entry. */
  readonly log: string[];
  /** @returns The sha256 of the log so far. */
  digest(): string;
}

/**
 * Creates a paint context that records every call (`[method, ...args]`) and every property
 * assignment (`["set", property, value]`). Method calls return the context itself, so gradient
 * stops recorded through `createLinearGradient(...).addColorStop(...)` land in the same log.
 *
 * @returns The recording context.
 */
export function create_recording_context(): RecordingContext {
  const log: string[] = [];
  const target: Record<string, unknown> = {};
  const proxy: PaintContext = new Proxy(target, {
    get(_object, property) {
      if (typeof property === "symbol") return undefined;
      return (...args: unknown[]) => {
        log.push(JSON.stringify([property, ...args.map(format_render_value)]));
        return proxy;
      };
    },
    set(_object, property, value) {
      if (typeof property === "symbol") return true;
      log.push(JSON.stringify(["set", property, format_render_value(value)]));
      return true;
    },
  }) as unknown as PaintContext;
  return {
    ctx: proxy,
    log,
    digest: () => createHash("sha256").update(log.join("\n")).digest("hex"),
  };
}

/**
 * Paints a spec into a fresh recording context.
 *
 * @param spec - The paint spec.
 * @returns The recording, plus the plan's size and frames.
 */
export function record_paint(spec: PaintSpec) {
  const plan = plan_texture(spec);
  const recording = create_recording_context();
  plan.paint(recording.ctx);
  return { ...recording, width: plan.width, height: plan.height, frames: plan.frames ?? [] };
}
