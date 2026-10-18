/**
 * Tests of the heads-up display: the world toolbar's label and message lookups for every build
 * tool, the dock's tab order, and server renders of the surfaces the shell's goldens do not
 * reach (the expanded debug panel and the update notice) or that must keep their inert pair.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BottomDock,
  DebugPanel,
  DOCK_ITEMS,
  get_toolbar_message,
  get_toolbar_mode_label,
  ToastStack,
  TopBar,
} from "@/app/game/hud";
import type { BuildTool } from "@/src/game/runtime/types";

/** A runtime controller ref with no runtime, as during server rendering. */
const NO_CONTROLLER = { current: undefined };

/** The name of a selected build item. */
const SELECTED_NAME = "Plastic table";

/** The fixed instruction each editor tool shows in place of the centre message. */
const QUEUE_MESSAGE = "Queue editor: choose adjacent clear tiles to bend the line; Escape finishes";
const ACCESS_MESSAGE = "Access editor: choose an entry or exit, then choose a boundary tile";
const ROUTE_MESSAGE =
  "Route editor: choose clear floor tiles to guide guests; choose a guide again to remove it; Escape finishes";

describe("get_toolbar_mode_label", () => {
  it.each<[BuildTool, string, string]>([
    ["select", "Planning mode", "Centre open"],
    ["place", "Build mode", "Build mode"],
    ["move", "Planning mode", "Centre open"],
    ["remove", "Planning mode", "Centre open"],
    ["queue", "Queue editor", "Queue editor"],
    ["access", "Access editor", "Access editor"],
    ["route", "Route editor", "Route editor"],
  ])("labels the %s tool %j when closed and %j when open", (tool, closed, open) => {
    expect([get_toolbar_mode_label(tool, false), get_toolbar_mode_label(tool, true)]).toEqual([
      closed,
      open,
    ]);
  });

  it("does not treat an inherited key as an editing tool", () => {
    expect(get_toolbar_mode_label("toString" as BuildTool, false)).toBe("Planning mode");
  });
});

describe("get_toolbar_message", () => {
  it.each<[BuildTool, string]>([
    ["select", `${SELECTED_NAME} selected — choose a clear tile`],
    ["place", `${SELECTED_NAME} selected — choose a clear tile`],
    ["move", `${SELECTED_NAME} selected — choose a clear tile`],
    ["remove", `${SELECTED_NAME} selected — choose a clear tile`],
    ["queue", QUEUE_MESSAGE],
    ["access", ACCESS_MESSAGE],
    ["route", ROUTE_MESSAGE],
  ])("shows %j with an item selected as %j", (tool, message) => {
    expect(get_toolbar_message(tool, { isOpen: true, activeCustomers: 3 }, SELECTED_NAME)).toBe(
      message,
    );
  });

  it.each<[BuildTool, string, string]>([
    ["select", "Arrange your centre, then open the shutters", "3 neighbours are visiting"],
    ["place", "Arrange your centre, then open the shutters", "3 neighbours are visiting"],
    ["move", "Arrange your centre, then open the shutters", "3 neighbours are visiting"],
    ["remove", "Arrange your centre, then open the shutters", "3 neighbours are visiting"],
    ["queue", QUEUE_MESSAGE, QUEUE_MESSAGE],
    ["access", ACCESS_MESSAGE, ACCESS_MESSAGE],
    ["route", ROUTE_MESSAGE, ROUTE_MESSAGE],
  ])("shows %j with nothing selected as %j when closed and %j when open", (tool, closed, open) => {
    expect([
      get_toolbar_message(tool, { isOpen: false, activeCustomers: 3 }, undefined),
      get_toolbar_message(tool, { isOpen: true, activeCustomers: 3 }, undefined),
    ]).toEqual([closed, open]);
  });

  it("does not treat an inherited key as an editor message", () => {
    expect(
      get_toolbar_message(
        "toString" as BuildTool,
        { isOpen: false, activeCustomers: 0 },
        undefined,
      ),
    ).toBe("Arrange your centre, then open the shutters");
  });
});

describe("DOCK_ITEMS", () => {
  it("lists the panel tabs in dock order", () => {
    expect(DOCK_ITEMS.map(([panel]) => panel)).toEqual([
      "focus",
      "build",
      "stalls",
      "dishes",
      "insights",
      "activity",
    ]);
  });
});

describe("BottomDock", () => {
  it("names the Activity tab with its unread count and marks the open panel's tab current", () => {
    const html = renderToStaticMarkup(
      createElement(BottomDock, {
        panel: "dishes",
        activityUnread: 2,
        isInert: false,
        onOpenPanel: () => undefined,
        onSaveNow: () => undefined,
      }),
    );

    expect([
      html.includes('class="is-active" aria-current="page" aria-label="Dishes"'),
      html.includes('aria-label="Activity, 2 unread"'),
      html.includes('<i class="dock-unread" aria-hidden="true">2</i>'),
    ]).toEqual([true, true, true]);
  });
});

describe("TopBar", () => {
  it("is inert and hidden from assistive technology while a modal is open", () => {
    const html = renderToStaticMarkup(
      createElement(TopBar, {
        snapshot: {
          cash: 1_000,
          reputation: 8,
          level: 1,
          experience: 0,
          nextLevelExperience: 120,
          day: 1,
          timeLabel: "10:30 AM",
          speed: 1,
        },
        isInert: true,
        onSetSpeed: () => undefined,
        onOpenSettings: () => undefined,
        onOpenHelp: () => undefined,
      }),
    );

    expect(html.startsWith('<header class="topbar" inert="" aria-hidden="true">')).toBe(true);
  });
});

describe("ToastStack", () => {
  it("shows the update notice ahead of the toasts", () => {
    const html = renderToStaticMarkup(
      createElement(ToastStack, {
        isUpdateReady: true,
        toasts: [{ id: 1, kind: "success", message: "Centre saved on this device." }],
        isInert: false,
        onApplyUpdate: () => undefined,
      }),
    );

    expect(html).toBe(
      '<div class="toast-stack" aria-live="polite" aria-atomic="false" aria-hidden="false">' +
        '<div class="toast info"><span>↻</span><p>A safe update is ready. Save, then reload when convenient.</p>' +
        '<button type="button">Save &amp; update</button></div>' +
        '<div class="toast success"><span aria-hidden="true">✓</span><p>Centre saved on this device.</p></div>' +
        "</div>",
    );
  });
});

describe("DebugPanel", () => {
  it("shows the timings and the developer actions when expanded", () => {
    const html = renderToStaticMarkup(
      createElement(DebugPanel, {
        isOpen: true,
        onToggle: () => undefined,
        snapshot: { fps: 59.6, simulationMs: 0.125 },
        controllerRef: NO_CONTROLLER,
        isInert: false,
      }),
    );

    expect(html).toBe(
      '<section class="debug-panel is-open" aria-label="Developer tools" aria-hidden="false">' +
        '<button type="button">Debug ×</button><div><code>60 FPS · 0.13 ms sim</code>' +
        '<button type="button">Show grid data</button><button type="button">Spawn customer</button>' +
        '<button type="button">+ $1,000</button></div></section>',
    );
  });
});
