import Link from 'next/link';
import {
  Workflow,
  Bot,
  Wrench,
  Database,
  Activity,
  ArrowRight,
  Sparkles,
  ShoppingCart,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AgentSea Admin UI
              </h1>
            </div>
            <div className="text-sm text-muted-foreground">v0.1.0</div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-5xl font-bold tracking-tight mb-6">
            Build AI Agents{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Visually
            </span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Create, configure, and orchestrate AI agents with an intuitive
            drag-and-drop interface. Build conversational AI, voice assistants,
            and commerce-enabled agents. No code required.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Get Started
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Key Capabilities */}
      <section className="container mx-auto px-4 py-8 mb-8">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-8">
            Powerful Features Built-In
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div className="p-4">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                20+
              </div>
              <div className="text-sm text-muted-foreground">
                AI Provider Support
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Anthropic, OpenAI, Gemini, Ollama & more
              </div>
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                14
              </div>
              <div className="text-sm text-muted-foreground">
                Commerce Tools (ACP)
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Full e-commerce with payments
              </div>
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                MCP
              </div>
              <div className="text-sm text-muted-foreground">
                Protocol Support
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Model Context Protocol integration
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Workflow Builder */}
          <Link
            href="/workflows"
            className="group p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Workflow className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold">Workflow Builder</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Design complex workflows with drag-and-drop nodes for sequential,
              parallel, and supervisor patterns.
            </p>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium group-hover:gap-3 transition-all">
              Create Workflow
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Agent Management */}
          <Link
            href="/agents"
            className="group p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Bot className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold">Agent Management</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Configure AI agents with custom prompts, tools, and behaviors.
              Support for multiple providers.
            </p>
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium group-hover:gap-3 transition-all">
              Manage Agents
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Tool Registry */}
          <Link
            href="/tools"
            className="group p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Wrench className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold">Tool Registry</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Browse and configure tools. Create custom tools with parameter
              validation and testing.
            </p>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium group-hover:gap-3 transition-all">
              Browse Tools
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Provider Setup */}
          <Link
            href="/providers"
            className="group p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-500 dark:hover:border-orange-500 transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Database className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold">Provider Setup</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Connect to Anthropic, OpenAI, Google, Ollama, and more. Test
              connections and manage API keys.
            </p>
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-medium group-hover:gap-3 transition-all">
              Configure Providers
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Execution Monitor */}
          <Link
            href="/executions"
            className="group p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-cyan-500 dark:hover:border-cyan-500 transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                <Activity className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold">Execution Monitor</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              View real-time execution logs, debug conversations, and monitor
              performance metrics.
            </p>
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-medium group-hover:gap-3 transition-all">
              View Executions
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Testing Playground */}
          <Link
            href="/playground"
            className="group p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-pink-500 dark:hover:border-pink-500 transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                <Sparkles className="h-6 w-6 text-pink-600 dark:text-pink-400" />
              </div>
              <h3 className="text-xl font-semibold">Testing Playground</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Test agents and workflows locally with live streaming output and
              debugging tools.
            </p>
            <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400 font-medium group-hover:gap-3 transition-all">
              Open Playground
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* ACP Commerce Integration */}
          <Link
            href="/docs/ACP_INTEGRATION"
            className="group p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold">ACP Commerce</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Build commerce-enabled agents with product search, cart
              management, checkout, and secure payments via ACP protocol.
            </p>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium group-hover:gap-3 transition-all">
              Explore Commerce Tools
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              © 2025 AgentSea. Open source under MIT License.
            </div>
            <div className="flex gap-6 text-sm">
              <Link
                href="https://github.com/lov3kaizen/agentsea"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                GitHub
              </Link>
              <Link
                href="/docs"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Documentation
              </Link>
              <Link
                href="/api-reference"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                API Reference
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
