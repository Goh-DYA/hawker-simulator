import { readdir, readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioDirector } from "@/src/game/audio/AudioDirector";
import { expect_console_warning } from "@/tests/console";

const root = new URL("../../../", import.meta.url);

async function filesBelow(url: URL): Promise<string[]> {
  const entries = await readdir(url, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), url);
    return entry.isDirectory() ? filesBelow(child) : [child.pathname];
  }));
  return nested.flat();
}

describe("procedural adaptive audio", () => {
  it("uses state-aware Web Audio synthesis with lifecycle and voice controls", async () => {
    const source = await readFile(new URL("src/game/audio/AudioDirector.ts", root), "utf8");
    expect(source).toContain("createOscillator");
    expect(source).toContain("setGameplayState");
    expect(source).toContain("visibilitychange");
    expect(source).toContain("setVoiceLimit");
    expect(source).toContain("oscillator.disconnect");
    expect(source).not.toMatch(/fetch\(|new Audio\(/);
  });

  it("ships no external recorded music files", async () => {
    const files = await filesBelow(new URL("public/", root));
    expect(files.filter((file) => /\.(mp3|ogg|wav|m4a|aac|flac)$/i.test(file))).toEqual([]);
  });
});

/** Minimal gain node: the director only sets targets and connects buses. */
function create_fake_gain_node() {
  return { gain: { setTargetAtTime: () => undefined }, connect: () => undefined };
}

/** AudioContext stand-in whose lifecycle promises all reject. */
class RejectingAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  createGain = create_fake_gain_node;
  close = () => Promise.reject(new Error("close rejected"));
  suspend = () => Promise.reject(new Error("suspend rejected"));
  resume = () => Promise.reject(new Error("resume rejected"));
}

/** Document stand-in that records the visibility listener so a test can fire it. */
function stub_document() {
  const fake_document = {
    hidden: false,
    visibilityListener: undefined as (() => void) | undefined,
    addEventListener(_type: string, listener: () => void) {
      fake_document.visibilityListener = listener;
    },
    removeEventListener: () => undefined,
  };
  vi.stubGlobal("document", fake_document);
  return fake_document;
}

/**
 * Create a director with an unlocked rejecting context.
 *
 * @returns The director and the fake document it listens to.
 */
async function create_unlocked_director() {
  vi.stubGlobal("AudioContext", RejectingAudioContext);
  const fake_document = stub_document();
  const director = new AudioDirector();
  await director.unlock();
  return { director, fake_document };
}

/** Let rejected lifecycle promises settle and reach their handlers. */
async function flush_promises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("AudioContext lifecycle failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs a rejected close when the director is destroyed", async () => {
    const { director } = await create_unlocked_director();
    expect_console_warning(/\[audio\] close failed Error: close rejected/);

    director.destroy();
    await flush_promises();
  });

  it("logs a rejected suspend when the page is hidden", async () => {
    const { fake_document } = await create_unlocked_director();
    expect_console_warning(/\[audio\] suspend failed Error: suspend rejected/);

    fake_document.hidden = true;
    fake_document.visibilityListener?.();
    await flush_promises();
  });

  it("logs a rejected resume when the page becomes visible", async () => {
    const { fake_document } = await create_unlocked_director();
    expect_console_warning(/\[audio\] resume failed Error: resume rejected/);

    fake_document.hidden = false;
    fake_document.visibilityListener?.();
    await flush_promises();
  });
});
