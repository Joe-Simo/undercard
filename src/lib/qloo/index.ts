import "server-only";
import { modes } from "../env";
import { LiveQlooClient } from "./live";
import { MockQlooClient } from "./mock";
import type { QlooClient } from "./types";

export function getQloo(): QlooClient {
  return modes().qloo === "live" ? new LiveQlooClient() : new MockQlooClient();
}
export type { QlooClient, EntityType, HeatCell } from "./types";
