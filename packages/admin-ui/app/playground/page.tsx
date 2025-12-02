'use client';

import { useState } from 'react';
import { Play, Square, Trash2, Download } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';

export default function PlaygroundPage() {
  const { agents, workflows } = useStore();
  const [selectedType, setSelectedType] = useState<'agent' | 'workflow'>('agent');
  const [selectedId, setSelectedId] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    if (!selectedId || !input) {
      alert('Please select an agent/workflow and provide input');
      return;
    }

    setIsRunning(true);
    setOutput('Running...\n');

    // Simulate execution (replace with actual API call)
    setTimeout(() => {
      setOutput((prev) => prev + '\nExecution completed!\n\nThis is a demo response.');
      setIsRunning(false);
    }, 2000);
  };

  const handleStop = () => {
    setIsRunning(false);
    setOutput((prev) => prev + '\n\nExecution stopped by user.');
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
  };

  const handleExport = () => {
    const data = {
      type: selectedType,
      id: selectedId,
      input,
      output,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Playground</h1>
        <p className="text-muted-foreground">
          Test your agents and workflows with live execution
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Select what to test</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="workflow">Workflow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {selectedType === 'agent' ? 'Select Agent' : 'Select Workflow'}
                </label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose one..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedType === 'agent'
                      ? agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))
                      : workflows.map((workflow) => (
                          <SelectItem key={workflow.id} value={workflow.id}>
                            {workflow.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Input</CardTitle>
              <CardDescription>Enter your prompt or task</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Type your message here..."
                rows={12}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isRunning}
              />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleRun}
              disabled={isRunning || !selectedId || !input}
            >
              {isRunning ? (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run
                </>
              )}
            </Button>
            {isRunning && (
              <Button variant="destructive" onClick={handleStop}>
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            )}
            <Button variant="outline" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
            {output && (
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </div>

        {/* Output Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Output</CardTitle>
                <CardDescription>Execution results and logs</CardDescription>
              </div>
              {isRunning && (
                <Badge variant="default" className="animate-pulse">
                  Running
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] rounded-md border bg-muted/50 p-4">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {output || 'Output will appear here...'}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
