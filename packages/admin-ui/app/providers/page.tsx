'use client';

import { useState } from 'react';
import { Plus, Search, Check, X } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';

const availableProviders = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude AI models',
    status: 'configured',
    isDefault: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models',
    status: 'not-configured',
    isDefault: false,
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Gemini models',
    status: 'not-configured',
    isDefault: false,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local models',
    status: 'not-configured',
    isDefault: false,
  },
];

export default function ProvidersPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProviders = availableProviders.filter(
    (provider) =>
      provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Providers</h1>
          <p className="text-muted-foreground">
            Configure LLM providers and API keys
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search providers..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredProviders.map((provider) => (
          <Card key={provider.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    {provider.status === 'configured' ? (
                      <Badge variant="default" className="gap-1">
                        <Check className="h-3 w-3" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <X className="h-3 w-3" />
                        Not Configured
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{provider.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Default Provider</span>
                <Switch checked={provider.isDefault} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  {provider.status === 'configured' ? 'Edit' : 'Configure'}
                </Button>
                {provider.status === 'configured' && (
                  <Button variant="outline">Test Connection</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">API Keys Security</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            API keys are encrypted and stored securely in your local database. They are
            never sent to external servers except when making API calls to the respective
            providers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
