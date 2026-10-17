import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth">
      <h1>Not found</h1>
      <p>That page doesn&apos;t exist, or it belongs to another account.</p>
      <p>
        <Link href="/">Go to your home page</Link>
      </p>
    </main>
  );
}
