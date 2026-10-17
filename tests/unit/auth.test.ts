// US-01 Sign up and sign in: the pieces that don't need a browser
import { describe, expect, it } from "vitest";
import { authErrorMessage, safeNext } from "@/lib/auth";

describe("US-01 safeNext keeps redirects on this site", () => {
  it("Given a next path inside the app, when I sign in, then I'm sent there", () => {
    expect(safeNext("/leases/abc")).toBe("/leases/abc");
  });
  it("Given no next path, when I sign in, then I'm sent home", () => {
    expect(safeNext(null)).toBe("/");
  });
  it.each(["//evil.example.com", "https://evil.example.com", "/\\evil.example.com", "leases"])(
    "Given a next value of %s, when I sign in, then I'm sent home instead",
    (value) => expect(safeNext(value)).toBe("/"),
  );
});

describe("US-01 auth errors are worded for the landlord", () => {
  it("TC-AUTH-02 Given Supabase says invalid credentials, when it's shown, then it reads 'Email or password is incorrect'", () => {
    expect(authErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(
      "Email or password is incorrect",
    );
  });
  it("TC-AUTH-04 Given the email is already registered, when it's shown, then it tells me to sign in instead", () => {
    expect(authErrorMessage({ code: "user_already_exists", message: "User already registered" })).toBe(
      "An account with this email already exists. Sign in instead.",
    );
  });
  it("Given the password is too short, when it's shown, then it gives the minimum length", () => {
    expect(authErrorMessage({ code: "weak_password", message: "Password should be at least 8 characters." })).toBe(
      "Use a password of at least 8 characters",
    );
  });
  it("Given the server can't be reached, when it's shown, then it says so and what to do", () => {
    expect(authErrorMessage(new TypeError("fetch failed"))).toBe(
      "Can't reach the server. Check your connection and try again.",
    );
  });
});
