'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowCanvas } from '@/components/workflow/workflow-canvas';
import { WorkflowSidebar } from '@/components/workflow/workflow-sidebar';
import { useStore } from '@/lib/store';

export default function NewWorkflowPage() {
  const router = useRouter();
  const { addWorkflow } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'sequential' | 'parallel' | 'supervisor'>('sequential');
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);

  const handleSave = useCallback(() => {
    if (!name) {
      alert('Please enter a workflow name');
      return;
    }

    const newWorkflow = {
      id: `workflow-${Date.now()}`,
      name,
      description,
      type,
      config: JSON.stringify({}),
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addWorkflow(newWorkflow);
    router.push('/workflows');
  }, [name, description, type, nodes, edges, addWorkflow, router]);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Left Sidebar */}
      <div className="w-80 flex-shrink-0">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/workflows">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">New Workflow</h1>
          </div>

          {/* Workflow Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="My Workflow"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe what this workflow does..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={type} onValueChange={(value: any) => setType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential</SelectItem>
                    <SelectItem value="parallel">Parallel</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSave} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Save Workflow
              </Button>
            </CardContent>
          </Card>

          {/* Node Templates */}
          <WorkflowSidebar />
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 rounded-lg border bg-card">
        <WorkflowCanvas
          initialNodes={nodes}
          initialEdges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
        />
      </div>
    </div>
  );
}
