'use client';

import { Handle, Position } from '@xyflow/react';
import { Workflow, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function WorkflowNode({ data, isConnectable }: any) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!bg-purple-500"
      />
      <Card className="min-w-[200px] shadow-lg border-purple-200">
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-purple-100 p-2">
                <Workflow className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{data.label}</h3>
                <p className="text-xs text-muted-foreground capitalize">{data.type}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Settings className="h-3 w-3" />
            </Button>
          </div>
          {data.description && (
            <p className="text-xs text-muted-foreground mt-2">{data.description}</p>
          )}
          {data.agentCount && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                {data.agentCount} agents
              </Badge>
            </div>
          )}
        </div>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!bg-purple-500"
      />
    </>
  );
}
