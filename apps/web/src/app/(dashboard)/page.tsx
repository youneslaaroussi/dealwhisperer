"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Card, 
  CardContent,
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { Bell, Briefcase, BarChart2, Timer, AlertCircle, CheckCircle2 } from "lucide-react";

type StaleDeals = {
  id: string;
  name: string;
}[];

type ActiveThread = {
  thread_ts: string;
  deal_id: string;
  deal_name: string;
  channel_id: string;
  created_at: string;
};

type DashboardData = {
  latestStaleDeals: StaleDeals;
  activeThreads: ActiveThread[];
  activeThreadsCount: number;
};

// Sample data format for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError('Failed to load dashboard data. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  // Data for charts derived from real data
  const pieData = [
    { name: 'Responded', value: dashboardData?.activeThreads?.length || 0 },
    { name: 'Pending', value: (dashboardData?.latestStaleDeals?.length || 0) - (dashboardData?.activeThreads?.length || 0) },
  ];

  // Page enter animation
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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <header className="mb-8">
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage your stale Salesforce deals with AI-powered insights
          </p>
        </motion.div>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deals">Stale Deals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Dashboard Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium">
                    Total Stale Deals
                  </CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-bold">
                      {dashboardData?.latestStaleDeals?.length || 0}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium">
                    Active Threads
                  </CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-bold">
                      {dashboardData?.activeThreadsCount || 0}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium">
                    Response Rate
                  </CardTitle>
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {dashboardData?.latestStaleDeals?.length 
                          ? Math.round((dashboardData.activeThreads.length / dashboardData.latestStaleDeals.length) * 100)
                          : 0}%
                      </div>
                      <Progress 
                        value={dashboardData?.latestStaleDeals?.length 
                          ? Math.round((dashboardData.activeThreads.length / dashboardData.latestStaleDeals.length) * 100)
                          : 0
                        } 
                        className="mt-2"
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Charts Section */}
          <div className="grid gap-4">
            <motion.div variants={itemVariants}>
              <Card className="h-[300px]">
                <CardHeader>
                  <CardTitle>Response Distribution</CardTitle>
                  <CardDescription>
                    Stale deals with responses vs pending
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center h-[200px]">
                      <Skeleton className="h-[200px] w-full" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Recent Activity Table */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest active Slack threads
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : dashboardData?.activeThreads && dashboardData.activeThreads.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Deal Name</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.activeThreads.slice(0, 5).map((thread) => (
                        <TableRow key={thread.thread_ts}>
                          <TableCell className="font-medium">{thread.deal_name}</TableCell>
                          <TableCell>
                            {new Date(thread.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                              Active
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex items-center justify-center p-6 text-center">
                    <div>
                      <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                      <p>No active threads at the moment</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="deals" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Stale Deals</CardTitle>
                <CardDescription>
                  Deals that need attention in Salesforce
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : dashboardData?.latestStaleDeals && dashboardData.latestStaleDeals.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Deal Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Thread</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.latestStaleDeals.map((deal) => {
                        const hasActiveThread = dashboardData.activeThreads.some(
                          (thread) => thread.deal_id === deal.id
                        );
                        
                        return (
                          <TableRow key={deal.id}>
                            <TableCell className="font-medium">{deal.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                hasActiveThread 
                                  ? "bg-green-100 text-green-800 border-green-200" 
                                  : "bg-yellow-100 text-yellow-800 border-yellow-200"
                              }>
                                {hasActiveThread ? "Active Thread" : "Needs Attention"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {hasActiveThread ? (
                                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                                  In Progress
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
                                  Not Started
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex items-center justify-center p-6 text-center">
                    <div>
                      <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                      <p>No stale deals found</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
} 