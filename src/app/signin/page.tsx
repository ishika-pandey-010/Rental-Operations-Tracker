import Link from "next/link";
import { AuthForm } from "../auth/auth-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="auth">
      <h1>Sign in</h1>
      <p className="muted">Rental Operations Tracker: rent, payments and deposits for your units.</p>
      <AuthForm mode="signin" next={next} />
      <p>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </main>
  );
}
