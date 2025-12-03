'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Workflow,
  Wrench,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStore } from '@/lib/store';

export default function DashboardPage() {
  const { agents, workflows, tools, executions } = useStore();
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalWorkflows: 0,
    totalTools: 0,
    recentExecutions: 0,
    successRate: 0,
  });

  useEffect(() => {
    // Calculate stats
    const completedExecutions = executions.filter((e) => e.status === 'completed').length;
    const totalExecutions = executions.length || 1; // Avoid division by zero

    setStats({
      totalAgents: agents.length,
      totalWorkflows: workflows.length,
      totalTools: tools.length,
      recentExecutions: executions.length,
      successRate: Math.round((completedExecutions / totalExecutions) * 100),
    });
  }, [agents, workflows, tools, executions]);

  const recentExecutions = executions.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your agents, workflows, and executions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAgents}</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/agents" className="text-blue-600 hover:underline">
                Manage agents
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWorkflows}</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/workflows" className="text-blue-600 hover:underline">
                View workflows
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Tools</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTools}</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/tools" className="text-blue-600 hover:underline">
                Browse tools
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              From {stats.recentExecutions} executions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with common tasks</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button asChild variant="outline" className="justify-start">
            <Link href="/agents/new">
              <Bot className="mr-2 h-4 w-4" />
              Create Agent
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/workflows/new">
              <Workflow className="mr-2 h-4 w-4" />
              New Workflow
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/tools">
              <Wrench className="mr-2 h-4 w-4" />
              Browse Tools
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/playground">
              <Activity className="mr-2 h-4 w-4" />
              Test Playground
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Executions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Executions</CardTitle>
            <CardDescription>Latest agent and workflow runs</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/executions">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentExecutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No executions yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create an agent or workflow to get started
              </p>
              <Button asChild className="mt-4">
                <Link href="/playground">
                  Open Playground
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentExecutions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell className="font-mono text-sm">
                      {execution.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {execution.workflowId ? 'Workflow' : 'Agent'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          execution.status === 'completed'
                            ? 'default'
                            : execution.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {execution.status === 'completed' && (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        {execution.status === 'failed' && (
                          <XCircle className="mr-1 h-3 w-3" />
                        )}
                        {execution.status === 'running' && (
                          <Clock className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {execution.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {execution.duration
                        ? `${(execution.duration / 1000).toFixed(2)}s`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {execution.createdAt
                        ? new Date(execution.createdAt).toLocaleDateString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
