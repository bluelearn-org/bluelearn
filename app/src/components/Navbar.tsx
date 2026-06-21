import { Menu, Search, User, X } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { label: "Browse", to: "/browse" },
  { label: "Subjects", to: "/subjects" },
  { label: "Learning Paths", to: "/paths" },
]

const profileItems = [
  { label: "Profile", to: "/profile" },
  { label: "Saved", to: "/saved" },
  { label: "Settings", to: "/settings" },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50">
      <div className="relative mx-auto max-w-[1280px] border-x border-b border-border/60 bg-white/20 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-6">

          {/* LEFT */}
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-3">
              <img src="/assets/logo.png" className="h-8 w-8" />
              <p className="text-[17px] font-semibold tracking-tight">
                BlueLearn
              </p>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>


          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {/* Desktop search */}
            <div className="relative hidden lg:block w-[280px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search guides..."
                className="h-9 pl-9 text-xs rounded-md border text-xs"
              />
            </div>

            {/* Contribute Button */}
            <div className="hidden md:flex">
              <Link
                to="/contribute"
                className="tracking-[0.08em] btn-cta"
              >
                Contribute
              </Link>
            </div>

            {/* Desktop Profile Dropdown */}
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
                      <Link to={item.to} className="text-xs">{item.label}</Link>
                    </DropdownMenuItem>
                  ))}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem asChild>
                    <Link to="/" className="text-destructive text-xs">Sign Out</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* MOBILE */}
          {/* Mobile Menu Button */}
          <div className="md:hidden relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-md"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileOpen && (
          <div className="md:hidden absolute left-0 right-0 top-[65px] p-5 z-50 rounded-b-md border bg-white shadow-md animate-in fade-in slide-in-from-top-2">

            <div className="flex flex-col gap-y-4">

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="h-9 pl-9 text-xs"
                />
              </div>

              {/* Nav */}
              <div className="py-3 flex flex-col gap-3">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="py-2 text-sm font-mono uppercase text-muted-foreground hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}

                <Separator />

                <Link
                  key="/contribute"
                  to="/contribute"
                  onClick={() => setMobileOpen(false)}
                  className="tracking-[0.08em] btn-cta"
                >
                  Contribute
                </Link>

                <Separator />

                {profileItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="py-2 text-sm font-mono uppercase text-muted-foreground hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}

                <Separator />

                <Link
                  to="/"
                  onClick={() => setMobileOpen(false)}
                  className="py-3 text-sm font-mono uppercase text-destructive"
                >
                  Sign Out
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}