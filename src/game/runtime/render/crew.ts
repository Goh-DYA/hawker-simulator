/**
 * The visible table-cleaning crew: where each crew member is and what they are doing, for the
 * world view to draw.
 *
 * The simulation core models the crew as a number (`count_cleaning_crew`) working on the oldest
 * left trays (`get_worked_tray_keys`), with no bodies. This module gives each member a body that
 * acts that work out: it walks to a tray the crew is clearing, wipes the table while the tray
 * waits, carries the tray to the nearest tray-return station once the core clears it, and then
 * walks back to its post. Member 0 keeps its post at the first tray-return station (or at the
 * exit before any station is placed) and each further member at its own station.
 *
 * It is cosmetic and never feeds the simulation: the core clears a tray on its own timer whether
 * or not the member has arrived. Motion advances by simulated time, so a paused centre freezes
 * the crew and a fast one hurries them along, and every route comes from the core's A* search
 * over the same blocked tiles and route guides the guests use. Everything here is deterministic
 * and Phaser-free.
 */
import {
  count_cleaning_crew,
  findPath,
  get_worked_tray_keys,
  getBlockedTileKeys,
  getSeatLocations,
  pointKey,
  type GameState,
  type GridPoint,
} from "@/src/game/core";
import { getObjectTrayReturnPoint } from "@/src/game/core/grid";
import { compareIds } from "@/src/game/core/ordering";

import { facing_for_direction, type Facing } from "../art/specs";

/** How fast a crew member walks, in tiles per simulated second, a touch brisker than guests. */
export const CREW_WALK_TILES_PER_SECOND = 2.4;
/** The longest simulated time one update advances the crew, so a long gap cannot fling them. */
const MAX_UPDATE_MS = 1_000;

/** What a crew member is doing, which picks their sheet frame. */
export type CrewActivity = "idle" | "walk" | "wipe" | "carry-walk";

/** One crew member as the world view draws them. */
export interface CrewMemberView {
  /** The member's index in the crew, from 0, which also picks their figure. */
  readonly index: number;
  /** Position in tile coordinates; whole numbers are tile centres. */
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  readonly activity: CrewActivity;
  /** The seat whose tray the member is heading to or wiping beside. */
  readonly seatKey?: string;
}

/** The task a crew member is on. */
type CrewTask = "post" | "to-tray" | "wipe" | "to-return";

/** A crew member's mutable motion state. */
interface CrewMember {
  readonly index: number;
  x: number;
  y: number;
  path: GridPoint[];
  pathIndex: number;
  task: CrewTask;
  seatKey: string | undefined;
  isCarrying: boolean;
  facing: Facing;
}

/** The world facts one update routes against. */
interface CrewWorld {
  readonly state: GameState;
  readonly blocked: ReadonlySet<string>;
  readonly preferred: ReadonlySet<string>;
  readonly stations: readonly GridPoint[];
}

/**
 * Gives the posts of a crew of a given size: member 0 at the first tray-return station (or the
 * exit, or the first access point, before any station is placed) and member `i` at station
 * `i - 1`.
 *
 * @param state - The game state.
 * @param stations - The tray-return drop-off points, in object ID order.
 * @param size - The crew size.
 * @returns One post per member.
 */
export function crew_posts(
  state: GameState,
  stations: readonly GridPoint[],
  size: number,
): GridPoint[] {
  const exit = state.accessPoints.find((point) => point.kind === "exit") ?? state.accessPoints[0];
  const first = stations[0] ?? exit?.position ?? { x: 0, y: 0 };
  return Array.from({ length: size }, (_, index) =>
    index === 0 ? first : (stations[index - 1] ?? first),
  );
}

/**
 * Lists the drop-off points of the tray-return stations, in object ID order.
 *
 * @param state - The game state.
 * @returns The points.
 */
function station_points(state: GameState): GridPoint[] {
  return Object.values(state.objects)
    .filter((object) => state.catalog.placeables[object.definitionId]?.kind === "tray-return")
    .sort((a, b) => compareIds(a.id, b.id))
    .flatMap((object) => {
      const point = getObjectTrayReturnPoint(object, state.catalog);
      return point ? [point] : [];
    });
}

/**
 * Gives the Manhattan distance between two tile positions.
 *
 * @param a - One position.
 * @param b - The other.
 * @returns The distance in tiles.
 */
function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Moves the table-cleaning crew between renders.
 */
export class CrewMotion {
  private members: CrewMember[] = [];
  private lastElapsedMs: number | undefined;

  /**
   * Advances the crew to a game state and reports where each member is.
   *
   * @param state - The game state to act out.
   * @returns One view per crew member, in index order.
   */
  update(state: GameState): readonly CrewMemberView[] {
    const stations = station_points(state);
    const world: CrewWorld = {
      state,
      blocked: getBlockedTileKeys(state.objects, state.catalog),
      preferred: new Set(state.routeGuidePoints.map(pointKey)),
      stations,
    };
    const size = count_cleaning_crew(state.objects, state.catalog);
    const posts = crew_posts(state, stations, size);
    // A clock that ran backwards means a reset, an import or a reload: start the crew afresh.
    const isRestart = this.lastElapsedMs === undefined || state.elapsedMs < this.lastElapsedMs;
    if (isRestart) this.members = [];
    const delta_ms = isRestart
      ? 0
      : Math.min(MAX_UPDATE_MS, state.elapsedMs - (this.lastElapsedMs ?? state.elapsedMs));
    this.lastElapsedMs = state.elapsedMs;
    this.resize(posts);
    this.assign(world, posts);
    for (const member of this.members) this.advance(member, world, posts, delta_ms);
    return this.members.map((member) => ({
      index: member.index,
      x: member.x,
      y: member.y,
      facing: member.facing,
      activity: this.activity_of(member),
      ...(member.seatKey === undefined ? {} : { seatKey: member.seatKey }),
    }));
  }

  /** Adds members at their posts, or removes the newest, to match the crew size. */
  private resize(posts: readonly GridPoint[]): void {
    while (this.members.length > posts.length) this.members.pop();
    while (this.members.length < posts.length) {
      const index = this.members.length;
      const post = posts[index] ?? { x: 0, y: 0 };
      this.members.push({
        index,
        x: post.x,
        y: post.y,
        path: [],
        pathIndex: 0,
        task: "post",
        seatKey: undefined,
        isCarrying: false,
        facing: "south",
      });
    }
  }

  /**
   * Releases members whose tray is gone and sends free members to the trays the crew is
   * working on, nearest member first.
   */
  private assign(world: CrewWorld, posts: readonly GridPoint[]): void {
    const { state } = world;
    const worked = get_worked_tray_keys(state);
    const worked_set = new Set(worked);
    const seats = new Map(
      getSeatLocations(state.objects, state.catalog).map((seat) => [seat.key, seat.point]),
    );
    for (const member of this.members) {
      if (member.seatKey === undefined) continue;
      const isCleared = state.unclearedTrays[member.seatKey] === undefined;
      if (isCleared && member.task === "wipe" && seats.has(member.seatKey)) {
        // The tray is cleared: carry it to the nearest station, or to the post without one.
        member.seatKey = undefined;
        member.isCarrying = true;
        member.task = "to-return";
        this.route(member, world, this.nearest_station(member, world) ?? posts[member.index]);
      } else if (isCleared || !worked_set.has(member.seatKey) || !seats.has(member.seatKey)) {
        member.seatKey = undefined;
        member.task = "post";
        this.route(member, world, posts[member.index]);
      }
    }
    const taken = new Set(this.members.flatMap((member) => member.seatKey ?? []));
    for (const key of worked) {
      if (taken.has(key)) continue;
      const seat = seats.get(key);
      if (!seat) continue;
      let best: CrewMember | undefined;
      for (const member of this.members) {
        if (member.seatKey !== undefined || member.isCarrying) continue;
        if (!best || manhattan(member, seat) < manhattan(best, seat)) best = member;
      }
      if (!best) break;
      best.seatKey = key;
      best.task = "to-tray";
      this.route(best, world, seat);
    }
  }

  /** Finds the tray-return station with the shortest walk from a member, if any. */
  private nearest_station(member: CrewMember, world: CrewWorld): GridPoint | undefined {
    let best: { point: GridPoint; length: number } | undefined;
    for (const point of world.stations) {
      const path = this.find_route(member, world, point);
      const length = path?.length ?? Number.POSITIVE_INFINITY;
      if (!best || length < best.length) best = { point, length };
    }
    return best?.point;
  }

  /**
   * Gives the tile a new route starts from: the tile the member is stepping onto when between
   * tiles, so they finish the step instead of cutting a corner.
   */
  private route_start(member: CrewMember): GridPoint {
    const next = member.path[member.pathIndex];
    return next ?? { x: Math.round(member.x), y: Math.round(member.y) };
  }

  /** Searches a route from where the member is to a destination. */
  private find_route(
    member: CrewMember,
    world: CrewWorld,
    destination: GridPoint,
  ): GridPoint[] | undefined {
    const result = findPath(world.state.map, this.route_start(member), destination, {
      blocked: world.blocked,
      preferred: world.preferred,
      allowEndBlocked: true,
    });
    return result.path ? [...result.path] : undefined;
  }

  /**
   * Sets a member walking to a destination. With no route (the layout cut them off), they step
   * straight there, so the crew never gets stuck out of sight.
   */
  private route(member: CrewMember, world: CrewWorld, destination: GridPoint | undefined): void {
    if (!destination) return;
    const path = this.find_route(member, world, destination) ?? [destination];
    member.path = path;
    member.pathIndex = 0;
  }

  /** Walks a member along their path for a slice of simulated time and settles arrivals. */
  private advance(
    member: CrewMember,
    world: CrewWorld,
    posts: readonly GridPoint[],
    delta_ms: number,
  ): void {
    let budget = (delta_ms / 1_000) * CREW_WALK_TILES_PER_SECOND;
    while (member.pathIndex < member.path.length) {
      const target = member.path[member.pathIndex];
      if (!target) break;
      const dx = target.x - member.x;
      const dy = target.y - member.y;
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance > 0)
        member.facing = facing_for_direction(Math.sign(dx), Math.sign(dy), member.facing);
      if (distance > budget) {
        member.x += distance === 0 ? 0 : (dx / distance) * budget;
        member.y += distance === 0 ? 0 : (dy / distance) * budget;
        return;
      }
      member.x = target.x;
      member.y = target.y;
      budget -= distance;
      member.pathIndex += 1;
    }
    member.path = [];
    member.pathIndex = 0;
    if (member.task === "to-tray") member.task = "wipe";
    else if (member.task === "to-return") {
      member.isCarrying = false;
      member.task = "post";
      this.route(member, world, posts[member.index]);
    } else if (member.task === "post") {
      const post = posts[member.index];
      if (post && (member.x !== post.x || member.y !== post.y)) this.route(member, world, post);
      else member.facing = "south";
    }
  }

  /** Names what a member is doing for the sheet frame. */
  private activity_of(member: CrewMember): CrewActivity {
    if (member.task === "wipe") return "wipe";
    const isMoving = member.pathIndex < member.path.length;
    if (member.isCarrying) return "carry-walk";
    return isMoving ? "walk" : "idle";
  }
}
