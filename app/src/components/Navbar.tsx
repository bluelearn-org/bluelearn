import { Menu, Search, Shield, User, X } from "lucide-react";
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
import { Logo } from "@/components/Logo";

const navItems: Array<{ label: string; to: string }> = [
  { label: "Browse", to: "/browse" },
  { label: "Subjects", to: "/subjects" },
  { label: "Objectives", to: "/objectives" },
  { label: "Todo", to: "/todos" },
];

// Profile isn't here because its link needs the signed-in username.
const profileItems = [{ label: "Settings", to: "/settings" }];

// `roles`, when set, hides the item from anyone holding none of them.
const sepcialRoleItems: Array<{
  label: string;
  to: string;
  roles?: Array<string>;
}> = [
  {
    label: "Review Queue",
    to: "/review",
    roles: ["verifier", "lead-verifier", "admin"],
  },
  { label: "Dashboard", to: "/dashboard", roles: ["lead-verifier", "admin"] },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { session, roles, currentProfile } = useAuth();
  const navigate = useNavigate();

  const visibleRoleItems = sepcialRoleItems.filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r))
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setMobileOpen(false);
    setQuery("");
    navigate({ to: "/browse", search: { q } });
  }

  async function handleSignOut() {
    await signOut();
    setMobileOpen(false);
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50">
      <div className="relative border-b border-border/60 bg-background/20 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
          {/* LEFT */}
          <div className="flex items-center gap-10">
            <Logo />
            <nav className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase transition-all duration-200 hover:scale-110"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {/* Desktop search */}
            <form
              onSubmit={handleSearch}
              className="relative hidden w-[280px] lg:block"
            >
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search guides, objectives..."
                placeholder="Search guides, objectives..."
                className="h-9 rounded-md border pl-9 text-xs"
              />
            </form>

            {/* Contribute Button */}
            <div className="hidden md:flex">
              <Link to="/contribute" className="btn-cta tracking-[0.08em]">
                Contribute
              </Link>
            </div>

            {roles.length > 0 && (
              <div className="hidden md:block">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-md"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-48 font-mono">
                    {visibleRoleItems.map((item) => (
                      <DropdownMenuItem key={item.to} asChild>
                        <Link to={item.to} className="text-xs">
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {session ? (
              /* Desktop Profile Dropdown */
              <div className="hidden md:block">
                <DropdownMenu modal={false}>
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
                    {currentProfile && (
                      <DropdownMenuItem asChild>
                        <Link
                          to="/profile/$username"
                          params={{ username: currentProfile.username }}
                          className="text-xs"
                        >
                          Profile
                        </Link>
                      </DropdownMenuItem>
                    )}

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
          <div className="absolute top-[65px] right-0 left-0 z-50 animate-in rounded-b-md border bg-popover p-5 text-popover-foreground shadow-md fade-in slide-in-from-top-2 md:hidden">
            <div className="flex flex-col gap-y-4">
              {/* Search */}
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search guides"
                  placeholder="Search..."
                  className="h-9 pl-9 text-xs"
                />
              </form>

              {/* Nav */}
              <div className="flex flex-col gap-3 py-3">
                {navItems.map((item) => (
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

                {roles.length > 0 && (
                  <>
                    {visibleRoleItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className="py-2 font-mono text-sm text-muted-foreground uppercase hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </>
                )}

                <Separator />

                {session ? (
                  <>
                    {currentProfile && (
                      <Link
                        to="/profile/$username"
                        params={{ username: currentProfile.username }}
                        onClick={() => setMobileOpen(false)}
                        className="py-2 font-mono text-sm text-muted-foreground uppercase hover:text-foreground"
                      >
                        Profile
                      </Link>
                    )}

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
