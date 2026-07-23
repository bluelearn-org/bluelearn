import { Menu, Search, User, X } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useAuth } from "@/lib/authContext";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

// `role`, when set, hides the item from anyone who doesn't hold it.
const navItems: Array<{ label: string; to: string; role?: string }> = [
  { label: "Browse", to: "/browse" },
  { label: "Subjects", to: "/subjects" },
  { label: "Objectives", to: "/objectives" },
  { label: "Review", to: "/review", role: "verifier" },
];

const profileItems = [
  { label: "Profile", to: "/profile" },
  { label: "Settings", to: "/settings" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { session, roles } = useAuth();
  const navigate = useNavigate();

  const visibleNavItems = navItems.filter(
    (item) => !item.role || roles.includes(item.role)
  );

  async function handleSignOut() {
    await signOut();
    setMobileOpen(false);
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50">
      <div className="relative mx-auto max-w-[1280px] border-x border-b border-border/60 bg-background/20 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">
          {/* LEFT */}
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-3">
              <img src="/assets/logo.png" className="h-8 w-8" />
              <p className="text-[17px] font-semibold tracking-tight">
                Bluelearn
              </p>
            </Link>

            <nav className="hidden items-center gap-6 md:flex">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:scale-110"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {/* Desktop search */}
            <div className="relative hidden w-[280px] lg:block">
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search guides..."
                className="h-9 rounded-md border pl-9 text-xs"
              />
            </div>

            {/* Contribute Button */}
            <div className="hidden md:flex">
              <Link to="/contribute" className="btn-cta tracking-[0.08em]">
                Contribute
              </Link>
            </div>

            {session ? (
              /* Desktop Profile Dropdown */
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-md"
                    >
                      <User className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-48 font-mono">
                    {profileItems.map((item) => (
                      <DropdownMenuItem key={item.to} asChild>
                        <Link to={item.to} className="text-xs">
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onSelect={handleSignOut}
                      className="text-xs text-destructive"
                    >
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="hidden md:flex">
                <Link to="/login" className="btn-outline">
                  Sign In
                </Link>
              </div>
            )}
          </div>

          {/* MOBILE */}
          {/* Mobile Menu Button */}
          <div className="relative md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-md"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileOpen && (
          <div className="absolute top-[65px] right-0 left-0 z-50 animate-in rounded-b-md border bg-white p-5 shadow-md fade-in slide-in-from-top-2 md:hidden">
            <div className="flex flex-col gap-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." className="h-9 pl-9 text-xs" />
              </div>

              {/* Nav */}
              <div className="flex flex-col gap-3 py-3">
                {visibleNavItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="py-2 font-mono text-sm text-muted-foreground uppercase hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}

                <Separator />

                <Link
                  key="/contribute"
                  to="/contribute"
                  onClick={() => setMobileOpen(false)}
                  className="btn-cta tracking-[0.08em]"
                >
                  Contribute
                </Link>

                <Separator />

                {session ? (
                  <>
                    {profileItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className="py-2 font-mono text-sm text-muted-foreground uppercase hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    ))}

                    <Separator />

                    <button
                      onClick={handleSignOut}
                      className="py-3 text-left font-mono text-sm text-destructive uppercase"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                      className="py-2 font-mono text-sm text-muted-foreground uppercase hover:text-foreground"
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileOpen(false)}
                      className="py-2 font-mono text-sm uppercase hover:text-foreground"
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
