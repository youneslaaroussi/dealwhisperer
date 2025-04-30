"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siSalesforce } from "simple-icons";

export function Navbar() {
  const { theme, setTheme } = useTheme();

  return (
    <motion.header
      className="sticky top-0 z-50 w-full border-b bg-background backdrop-blur-sm"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-screen-xl mx-auto flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            role="img"
            viewBox="0 0 24 24"
            width="28"
            height="28"
            fill="#0176d3"
            className="ml-2 text-foreground fill-foreground"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d={siSalesforce.path} />
          </svg>
          <span className="font-bold text-xl">Deal Whisperer</span>
          <span className="hidden md:inline-block text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full ml-2">
            Agentforce Hackathon
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="mr-2"
          >
            <SunIcon className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <MoonIcon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* <Button className="bg-[#0176d3] hover:bg-[#014486] text-white">
            <LogInIcon className="mr-2 h-4 w-4" />
            Salesforce Login
          </Button> */}
        </div>
      </div>
    </motion.header>
  );
} 