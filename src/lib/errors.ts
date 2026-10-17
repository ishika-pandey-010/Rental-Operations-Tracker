// Turns database errors into sentences a landlord can act on.
//
// Rules live in Postgres (D-22). Errors raised by our own triggers and
// functions (SQLSTATE P0001) are already worded for the landlord and are
// shown as they are. Constraint violations carry only a constraint name,
// so each one we expect is mapped here.
import { NETWORK_ERROR } from "./auth";

export const CONSTRAINT_MESSAGES: Record<string, string> = {
  properties_name_not_blank: "Give the property a name",
  units_label_not_blank: "Give the unit a label",
  units_property_id_label_key: "Unit label already used in this property",
  tenants_name_not_blank: "Add the tenant's name",
  tenants_contact_required: "Add a phone number or email",
};

type DbErrorLike = { code?: string; message?: string; details?: string | null; hint?: string | null };

export function dbErrorMessage(error: DbErrorLike | Error | null | undefined): string {
  if (!error) return "Something went wrong. Try again.";
  const message = error.message ?? "";
  if (error instanceof TypeError || /fetch failed|network|ECONNREFUSED/i.test(message)) return NETWORK_ERROR;
  const code = "code" in error ? error.code : undefined;
  if (code === "P0001") return message;
  const constraint = /constraint "([^"]+)"/.exec(message)?.[1];
  if (constraint && CONSTRAINT_MESSAGES[constraint]) return CONSTRAINT_MESSAGES[constraint];
  if (code === "42501") return "You don't have access to that record.";
  if (code === "PGRST116") return "That record doesn't exist, or it belongs to another account.";
  return "Something went wrong saving that. Nothing was changed; try again.";
}

export const NOT_FOUND = "That record doesn't exist, or it belongs to another account.";
