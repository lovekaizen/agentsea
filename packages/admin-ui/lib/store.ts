import { create } from 'zustand';
import { Agent, Workflow, Tool, Provider, Execution } from './db/schema';

interface AppState {
  // Agents
  agents: Agent[];
  selectedAgent: Agent | null;
  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agent: Agent | null) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, agent: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;

  // Workflows
  workflows: Workflow[];
  selectedWorkflow: Workflow | null;
  setWorkflows: (workflows: Workflow[]) => void;
  setSelectedWorkflow: (workflow: Workflow | null) => void;
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, workflow: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;

  // Tools
  tools: Tool[];
  setTools: (tools: Tool[]) => void;
  addTool: (tool: Tool) => void;
  updateTool: (id: string, tool: Partial<Tool>) => void;
  deleteTool: (id: string) => void;

  // Providers
  providers: Provider[];
  setProviders: (providers: Provider[]) => void;
  addProvider: (provider: Provider) => void;
  updateProvider: (id: string, provider: Partial<Provider>) => void;
  deleteProvider: (id: string) => void;

  // Executions
  executions: Execution[];
  setExecutions: (executions: Execution[]) => void;
  addExecution: (execution: Execution) => void;
  updateExecution: (id: string, execution: Partial<Execution>) => void;

  // UI State
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  // Agents
  agents: [],
  selectedAgent: null,
  setAgents: (agents) => set({ agents }),
  setSelectedAgent: (selectedAgent) => set({ selectedAgent }),
  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
  updateAgent: (id, updatedAgent) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, ...updatedAgent } : a,
      ),
    })),
  deleteAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      selectedAgent:
        state.selectedAgent?.id === id ? null : state.selectedAgent,
    })),

  // Workflows
  workflows: [],
  selectedWorkflow: null,
  setWorkflows: (workflows) => set({ workflows }),
  setSelectedWorkflow: (selectedWorkflow) => set({ selectedWorkflow }),
  addWorkflow: (workflow) =>
    set((state) => ({ workflows: [...state.workflows, workflow] })),
  updateWorkflow: (id, updatedWorkflow) =>
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, ...updatedWorkflow } : w,
      ),
    })),
  deleteWorkflow: (id) =>
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== id),
      selectedWorkflow:
        state.selectedWorkflow?.id === id ? null : state.selectedWorkflow,
    })),

  // Tools
  tools: [],
  setTools: (tools) => set({ tools }),
  addTool: (tool) => set((state) => ({ tools: [...state.tools, tool] })),
  updateTool: (id, updatedTool) =>
    set((state) => ({
      tools: state.tools.map((t) =>
        t.id === id ? { ...t, ...updatedTool } : t,
      ),
    })),
  deleteTool: (id) =>
    set((state) => ({
      tools: state.tools.filter((t) => t.id !== id),
    })),

  // Providers
  providers: [],
  setProviders: (providers) => set({ providers }),
  addProvider: (provider) =>
    set((state) => ({ providers: [...state.providers, provider] })),
  updateProvider: (id, updatedProvider) =>
    set((state) => ({
      providers: state.providers.map((p) =>
        p.id === id ? { ...p, ...updatedProvider } : p,
      ),
    })),
  deleteProvider: (id) =>
    set((state) => ({
      providers: state.providers.filter((p) => p.id !== id),
    })),

  // Executions
  executions: [],
  setExecutions: (executions) => set({ executions }),
  addExecution: (execution) =>
    set((state) => ({ executions: [...state.executions, execution] })),
  updateExecution: (id, updatedExecution) =>
    set((state) => ({
      executions: state.executions.map((e) =>
        e.id === id ? { ...e, ...updatedExecution } : e,
      ),
    })),

  // UI State
  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
