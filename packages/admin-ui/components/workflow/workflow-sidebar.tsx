'use client';

import { Bot, Workflow, GitBranch, Users } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const nodeTemplates = [
  {
    type: 'agent',
    label: 'Agent Node',
    icon: Bot,
    description: 'Add an AI agent',
    color: 'blue',
  },
  {
    type: 'workflow',
    label: 'Sequential',
    icon: Workflow,
    description: 'Sequential workflow',
    color: 'purple',
  },
  {
    type: 'workflow',
    label: 'Parallel',
    icon: GitBranch,
    description: 'Parallel execution',
    color: 'green',
  },
  {
    type: 'workflow',
    label: 'Supervisor',
    icon: Users,
    description: 'Supervisor pattern',
    color: 'orange',
  },
];

interface WorkflowSidebarProps {
  onAddNode?: (type: string, data: any) => void;
}

export function WorkflowSidebar({ onAddNode }: WorkflowSidebarProps) {
  const handleDragStart = (event: React.DragEvent, nodeType: string, data: any) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, data }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Components</CardTitle>
        <CardDescription>Drag nodes onto the canvas</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-2">
            {nodeTemplates.map((template, idx) => {
              const Icon = template.icon;
              return (
                <div key={idx}>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto p-3 cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) =>
                      handleDragStart(e, template.type, {
                        label: template.label,
                        type: template.label.toLowerCase(),
                      })
                    }
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div
                        className={`rounded-lg p-2 bg-${template.color}-100`}
                      >
                        <Icon className={`h-4 w-4 text-${template.color}-600`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-sm">
                          {template.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {template.description}
                        </div>
                      </div>
                    </div>
                  </Button>
                </div>
              );
            })}
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Tips</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Drag nodes from here to the canvas</li>
              <li>• Connect nodes by dragging from handles</li>
              <li>• Double-click a node to configure</li>
              <li>• Press Delete to remove selected nodes</li>
            </ul>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
