import Link from "next/link";
import { AuthForm } from "../auth/auth-form";

export const metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <main className="auth">
      <h1>Create an account</h1>
      <p className="muted">One account per landlord. Your records are visible only to you.</p>
      <AuthForm mode="signup" />
      <p>
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </main>
  );
}
