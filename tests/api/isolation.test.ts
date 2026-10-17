// US-02 My data stays mine, checked through the REST API (PostgREST) that the app uses.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, signedUpClient } from "./client";

let a: SupabaseClient;
let b: SupabaseClient;
let aPropertyId: string;
let aLeaseId: string;

beforeAll(async () => {
  a = (await signedUpClient("api-a")).client;
  b = (await signedUpClient("api-b")).client;
  const { data, error } = await a.rpc("create_property", { p_name: "A Street", p_address: null, p_unit_labels: ["1"] });
  if (error) throw error;
  aPropertyId = data as string;
  const { data: unit } = await a.from("units").select("id").eq("property_id", aPropertyId).single();
  const { data: tenant } = await a.from("tenants").insert({ full_name: "A Tenant", email: "t@a.test" }).select("id").single();
  const lease = await a.rpc("create_lease", {
    p_unit_id: unit!.id,
    p_tenant_id: tenant!.id,
    p_start: "2026-11-01",
    p_end: "2027-10-31",
    p_monthly_rent_cents: 120000,
    p_due_day: 1,
  });
  if (lease.error) throw lease.error;
  aLeaseId = lease.data as string;
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

  it("TC-NFR-02 Given A's lease ID, when B requests that lease through the API, then no row is returned", async () => {
    const { data, error } = await b.from("leases").select("*").eq("id", aLeaseId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("TC-NFR-03 Given A's lease ID, when B inserts a deposit against it through the API, then the insert is rejected", async () => {
    const { data, error } = await b.from("deposits").insert({ lease_id: aLeaseId, amount_cents: 100, received_on: "2026-10-01" }).select();
    expect(data).toBeNull();
    expect(["23503", "42501"]).toContain(error?.code);
  });

  it("Given someone who isn't signed in, when they list properties through the API, then they're refused", async () => {
    const { data, error } = await anonClient().from("properties").select("*");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });
});
