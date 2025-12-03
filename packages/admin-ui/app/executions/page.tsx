'use client';

import { useState } from 'react';
import { Search, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/lib/store';

export default function ExecutionsPage() {
  const { executions } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const filterExecutions = (status?: string) => {
    return executions
      .filter((execution) => {
        const matchesSearch =
          execution.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          execution.input.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = !status || execution.status === status;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
  };

  const stats = {
    total: executions.length,
    completed: executions.filter((e) => e.status === 'completed').length,
    failed: executions.filter((e) => e.status === 'failed').length,
    running: executions.filter((e) => e.status === 'running').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executions</h1>
        <p className="text-muted-foreground">
          Monitor agent and workflow execution history
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Running</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search executions..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Executions Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="running">Running</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <ExecutionsTable executions={filterExecutions()} getStatusIcon={getStatusIcon} />
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <ExecutionsTable
            executions={filterExecutions('completed')}
            getStatusIcon={getStatusIcon}
          />
        </TabsContent>

        <TabsContent value="failed" className="mt-6">
          <ExecutionsTable
            executions={filterExecutions('failed')}
            getStatusIcon={getStatusIcon}
          />
        </TabsContent>

        <TabsContent value="running" className="mt-6">
          <ExecutionsTable
            executions={filterExecutions('running')}
            getStatusIcon={getStatusIcon}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExecutionsTable({
  executions,
  getStatusIcon,
}: {
  executions: any[];
  getStatusIcon: (status: string) => JSX.Element;
}) {
  if (executions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No executions found</h3>
          <p className="text-sm text-muted-foreground">
            Executions will appear here once you run agents or workflows
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Input</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {executions.map((execution) => (
              <TableRow key={execution.id}>
                <TableCell className="font-mono text-sm">
                  {execution.id.slice(0, 8)}...
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {execution.workflowId ? 'Workflow' : 'Agent'}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {execution.input}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(execution.status)}
                    <span className="capitalize">{execution.status}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {execution.duration
                    ? `${(execution.duration / 1000).toFixed(2)}s`
                    : '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {execution.createdAt
                    ? new Date(execution.createdAt).toLocaleString()
                    : '-'}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
