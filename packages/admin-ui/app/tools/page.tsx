'use client';

import { useState } from 'react';
import { Plus, Search, Wrench, Code, Globe, FileText } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const builtInTools = [
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Perform mathematical calculations',
    category: 'built-in',
    icon: Code,
  },
  {
    id: 'http-request',
    name: 'HTTP Request',
    description: 'Make HTTP requests to APIs',
    category: 'built-in',
    icon: Globe,
  },
  {
    id: 'file-operations',
    name: 'File Operations',
    description: 'Read and write files',
    category: 'built-in',
    icon: FileText,
  },
  {
    id: 'text-processing',
    name: 'Text Processing',
    description: 'Process and manipulate text',
    category: 'built-in',
    icon: FileText,
  },
];

export default function ToolsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = builtInTools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tools</h1>
          <p className="text-muted-foreground">
            Browse and configure tools for your agents
          </p>
        </div>
        <Button asChild>
          <Link href="/tools/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Custom Tool
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tools..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tools Tabs */}
      <Tabs defaultValue="built-in">
        <TabsList>
          <TabsTrigger value="built-in">Built-in Tools</TabsTrigger>
          <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
          <TabsTrigger value="custom">Custom Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="built-in" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Card key={tool.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-green-100 p-2">
                        <Icon className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{tool.name}</CardTitle>
                        <CardDescription>{tool.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Built-in</Badge>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="mcp" className="mt-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No MCP servers configured</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Connect MCP servers to extend agent capabilities
              </p>
              <Button asChild>
                <Link href="/providers">Configure MCP Servers</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="mt-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Plus className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No custom tools yet</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Create custom tools with your own logic
              </p>
              <Button asChild>
                <Link href="/tools/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Custom Tool
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
