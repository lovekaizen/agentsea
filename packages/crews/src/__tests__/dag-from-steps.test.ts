import { describe, it, expect } from 'vitest';
import { createDAGFromSteps } from '../workflows/DAGExecutor.js';
import type { WorkflowStepConfig, StepHandler } from '../types/index.js';

const noHandlers = new Map<string, StepHandler>();

function step(name: string, dependsOn?: string[]): WorkflowStepConfig {
  return { name, dependsOn };
}

describe('createDAGFromSteps', () => {
  it('defaults to a sequential chain when no dependsOn is declared', () => {
    const dag = createDAGFromSteps(
      [step('a'), step('b'), step('c')],
      noHandlers,
    );

    const [a, b, c] = dag.nodes;
    expect(a.dependencies).toEqual([]);
    expect(b.dependencies).toEqual([a.id]);
    expect(c.dependencies).toEqual([b.id]);
  });

  it('honors explicit dependsOn so independent steps can run in parallel', () => {
    // a, then b and c both depend only on a (so b and c are parallel),
    // then d depends on both b and c.
    const dag = createDAGFromSteps(
      [step('a'), step('b', ['a']), step('c', ['a']), step('d', ['b', 'c'])],
      noHandlers,
    );

    const byName = new Map(dag.nodes.map((n) => [n.name, n]));
    const a = byName.get('a')!;
    const b = byName.get('b')!;
    const c = byName.get('c')!;
    const d = byName.get('d')!;

    expect(a.dependencies).toEqual([]);
    expect(b.dependencies).toEqual([a.id]);
    expect(c.dependencies).toEqual([a.id]);
    // b and c share the same single dependency → they are not chained together
    expect(b.dependencies).not.toContain(c.id);
    expect(d.dependencies).toEqual(expect.arrayContaining([b.id, c.id]));
    expect(d.dependencies).toHaveLength(2);
  });

  it('resolves forward references regardless of declaration order', () => {
    const dag = createDAGFromSteps(
      [step('first', ['second']), step('second')],
      noHandlers,
    );

    const first = dag.nodes.find((n) => n.name === 'first')!;
    const second = dag.nodes.find((n) => n.name === 'second')!;
    expect(first.dependencies).toEqual([second.id]);
  });

  it('ignores unknown dependency names without throwing', () => {
    const dag = createDAGFromSteps([step('a', ['does-not-exist'])], noHandlers);
    expect(dag.nodes[0].dependencies).toEqual([]);
  });
});
