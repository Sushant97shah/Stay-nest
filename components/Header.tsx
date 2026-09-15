"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/components/AuthModalProvider";

export function Header() {
  const { session, signOut } = useAuth();
  const { openLogin } = useAuthModal();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  function handleOwnerClick() {
    if (!session) {
      openLogin("owner");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/#home">
          <span className="brand-mark">S</span>
          <span>
            stay<span className="brand-accent">nest</span>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/#explore">Find a stay</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#owner">List your property →</Link>
        </nav>
        <div className="header-actions">
          <button className="btn btn-ghost" type="button" onClick={handleOwnerClick}>
            For owners
          </button>
          {session ? (
            <div className="user-pod" data-user-role={session.role}>
              <span>Hi, {session.name}</span>
              <button className="mini-logout" type="button" onClick={() => signOut()}>
                Logout
              </button>
            </div>
          ) : (
            <button className="btn btn-dark user-pod" type="button" onClick={() => openLogin("tenant")}>
              Sign in
            </button>
          )}
          <button className="menu-btn" aria-label="Open menu" type="button" onClick={() => setMenuOpen(true)}>
            ☰
          </button>
        </div>
      </header>

      <div className={`mobile-nav${menuOpen ? " open" : ""}`} id="mobile-nav" aria-label="Mobile navigation">
        <button className="mobile-nav-close" aria-label="Close menu" type="button" onClick={closeMenu}>
          ×
        </button>
        <Link href="/#explore" onClick={closeMenu}>
          Find a stay
        </Link>
        <Link href="/#how-it-works" onClick={closeMenu}>
          How it works
        </Link>
        <Link href="/#owner" onClick={closeMenu}>
          List your property →
        </Link>
      </div>
      <div className="mobile-nav-scrim" onClick={closeMenu} />
    </>
  );
}
