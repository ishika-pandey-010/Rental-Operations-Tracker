import Link from "next/link";
import { Nav } from "@/components/nav";
import { signOut } from "../auth/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            Rental Ops
          </Link>
          <Nav />
          <form action={signOut}>
            <button type="submit" className="secondary">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main id="main">{children}</main>
    </>
  );
}
