// US-02 My data stays mine, checked through the REST API (PostgREST) that the app uses.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, signedUpClient } from "./client";

let a: SupabaseClient;
let b: SupabaseClient;
let aPropertyId: string;

beforeAll(async () => {
  a = (await signedUpClient("api-a")).client;
  b = (await signedUpClient("api-b")).client;
  const { data, error } = await a.rpc("create_property", { p_name: "A Street", p_address: null, p_unit_labels: ["1"] });
  if (error) throw error;
  aPropertyId = data as string;
});

describe("US-02 My data stays mine (REST API)", () => {
  it("Given A's property ID, when B requests it through the API, then no row is returned", async () => {
    const { data, error } = await b.from("properties").select("*").eq("id", aPropertyId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("Given A's property ID, when B renames it through the API, then nothing changes", async () => {
    const { data } = await b.from("properties").update({ name: "Taken" }).eq("id", aPropertyId).select();
    expect(data).toEqual([]);
    const { data: mine } = await a.from("properties").select("name").eq("id", aPropertyId).single();
    expect(mine).toEqual({ name: "A Street" });
  });

  it("Given someone who isn't signed in, when they list properties through the API, then they're refused", async () => {
    const { data, error } = await anonClient().from("properties").select("*");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });
});
