'use client';

import { Handle, Position } from '@xyflow/react';
import { Bot, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function AgentNode({ data, isConnectable }: any) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!bg-blue-500"
      />
      <Card className="min-w-[200px] shadow-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-100 p-2">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{data.label}</h3>
                <p className="text-xs text-muted-foreground">{data.model}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Settings className="h-3 w-3" />
            </Button>
          </div>
          {data.description && (
            <p className="text-xs text-muted-foreground mt-2">{data.description}</p>
          )}
          {data.tools && data.tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {data.tools.slice(0, 3).map((tool: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tool}
                </Badge>
              ))}
              {data.tools.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{data.tools.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!bg-blue-500"
      />
    </>
  );
}
