"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/file-upload";
import { BuildingIcon } from "lucide-react";

export default function CompanyInfoPage() {
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <header className="mb-8">
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2">
            <BuildingIcon className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Company Information</h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Upload documents and information about your company
          </p>
        </motion.div>
      </header>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Document Upload</CardTitle>
            <CardDescription>
              Upload your company documents for processing by Deal Whisperer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
} 