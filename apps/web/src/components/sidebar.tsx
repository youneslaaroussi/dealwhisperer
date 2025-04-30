"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  HomeIcon, 
  BuildingIcon, 
  UsersIcon, 
  SettingsIcon, 
  BarChart4Icon, 
  FileTextIcon 
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  
  const navItems = [
    {
      name: "Home",
      href: "/",
      icon: HomeIcon,
      active: pathname === "/"
    },
    {
      name: "Company Information",
      href: "/company",
      icon: BuildingIcon,
      active: pathname === "/company"
    },
    {
      name: "Key People",
      href: "/key-people",
      icon: UsersIcon,
      active: pathname === "/key-people"
    },
    {
      name: "Reports",
      href: "#",
      icon: BarChart4Icon,
      active: false,
      disabled: true
    },
    {
      name: "Documents",
      href: "#",
      icon: FileTextIcon,
      active: false,
      disabled: true
    },
    {
      name: "Settings",
      href: "#",
      icon: SettingsIcon,
      active: false,
      disabled: true
    }
  ];

  return (
    <motion.div
      className={cn("h-screen w-64 border-r bg-background p-4", className)}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">NAVIGATION</h2>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium relative",
                  item.active 
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  item.disabled && "pointer-events-none opacity-50"
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.name}
                {item.active && (
                  <motion.div
                    className="absolute left-0 h-6 w-1 rounded-r-full bg-primary"
                    layoutId="sidebar-highlight"
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 30
                    }}
                  />
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </motion.div>
  );
} 