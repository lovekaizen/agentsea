'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgentForm } from '@/components/agent/agent-form';
import { useStore } from '@/lib/store';

export default function NewAgentPage() {
  const router = useRouter();
  const { addAgent } = useStore();

  const handleSubmit = (data: any) => {
    const newAgent = {
      id: `agent-${Date.now()}`,
      ...data,
      tools: JSON.stringify(data.tools || []),
      memoryConfig: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addAgent(newAgent);
    router.push('/agents');
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/agents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Agent</h1>
          <p className="text-muted-foreground">
            Create a new AI agent with custom configuration
          </p>
        </div>
      </div>

      {/* Form */}
      <AgentForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/agents')}
      />
    </div>
  );
}
