import type { AgentResponse as AgentResponseType } from '@lov3kaizen/agentsea-core';
import { render, screen, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AgentResponse, useFormattedContent } from '../AgentResponse';

function baseResponse(
  overrides: Partial<AgentResponseType> = {},
): AgentResponseType {
  return {
    content: 'Hello **world**',
    metadata: { tokensUsed: 10, latencyMs: 123, iterations: 1 },
    ...overrides,
  };
}

describe('<AgentResponse />', () => {
  it('renders raw content as markdown by default', () => {
    render(<AgentResponse response={baseResponse()} />);
    // remark-gfm renders **world** as a <strong>
    expect(screen.getByText('world').tagName).toBe('STRONG');
  });

  it('applies the agentsea-response class and theme attribute', () => {
    const { container } = render(
      <AgentResponse response={baseResponse()} className="custom" theme="dark" />,
    );
    const root = container.querySelector('.agentsea-response');
    expect(root).not.toBeNull();
    expect(root).toHaveClass('custom');
    expect(root).toHaveAttribute('data-theme', 'dark');
  });

  it('does not render metadata when showMetadata is false', () => {
    render(<AgentResponse response={baseResponse()} />);
    expect(screen.queryByText('Tokens:')).toBeNull();
  });

  it('renders metadata block when showMetadata is true', () => {
    render(<AgentResponse response={baseResponse()} showMetadata />);
    expect(screen.getByText('Tokens:')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('123ms')).toBeInTheDocument();
  });

  it('renders formatted cost when present', () => {
    render(
      <AgentResponse
        response={baseResponse({
          metadata: {
            tokensUsed: 1,
            latencyMs: 1,
            iterations: 1,
            cost: 0.12345,
          },
        })}
        showMetadata
      />,
    );
    expect(screen.getByText('$0.1235')).toBeInTheDocument();
  });

  it('renders HTML content via dangerouslySetInnerHTML for html format', () => {
    const response = baseResponse({
      content: 'raw',
      formatted: {
        raw: 'raw',
        format: 'html',
        rendered: '<p class="from-html">hi</p>',
      },
    });
    const { container } = render(<AgentResponse response={response} />);
    expect(container.querySelector('.from-html')).not.toBeNull();
  });

  it('renders plain text content for text format without markdown', () => {
    const response = baseResponse({
      content: 'just text',
      formatted: { raw: 'just text', format: 'text' },
    });
    const { container } = render(<AgentResponse response={response} />);
    expect(container.querySelector('.agentsea-text-content')?.textContent).toBe(
      'just text',
    );
  });
});

describe('useFormattedContent', () => {
  it('wraps content with the default markdown format', async () => {
    const { result } = renderHook(() => useFormattedContent('hello'));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.raw).toBe('hello');
    expect(result.current?.format).toBe('markdown');
  });

  it('honors an explicit format argument', async () => {
    const { result } = renderHook(() => useFormattedContent('x', 'html'));
    await waitFor(() => expect(result.current?.format).toBe('html'));
  });
});
