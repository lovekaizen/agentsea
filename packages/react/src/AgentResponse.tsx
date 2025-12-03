import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import type {
  AgentResponse as AgentResponseType,
  FormattedContent,
} from '@lov3kaizen/agentsea-core';

export interface AgentResponseProps {
  response: AgentResponseType;
  className?: string;
  showMetadata?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  components?: React.ComponentProps<typeof ReactMarkdown>['components'];
}

/**
 * Component for rendering agent responses with formatting support
 */
export const AgentResponse: React.FC<AgentResponseProps> = ({
  response,
  className = '',
  showMetadata = false,
  theme = 'auto',
  components,
}) => {
  const formatted = response.formatted;
  const content = formatted?.raw || response.content;

  // Determine if we should render as markdown
  const shouldRenderMarkdown =
    !formatted ||
    formatted.format === 'markdown' ||
    formatted.format === 'react';

  return (
    <div className={`agentsea-response ${className}`} data-theme={theme}>
      {shouldRenderMarkdown ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeRaw]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      ) : formatted?.format === 'html' ? (
        <div
          dangerouslySetInnerHTML={{ __html: formatted.rendered || content }}
        />
      ) : (
        <div className="agentsea-text-content">{content}</div>
      )}

      {showMetadata && response.metadata && (
        <div className="agentsea-metadata">
          <div className="metadata-item">
            <span className="label">Tokens:</span>
            <span className="value">{response.metadata.tokensUsed}</span>
          </div>
          <div className="metadata-item">
            <span className="label">Latency:</span>
            <span className="value">{response.metadata.latencyMs}ms</span>
          </div>
          <div className="metadata-item">
            <span className="label">Iterations:</span>
            <span className="value">{response.metadata.iterations}</span>
          </div>
          {response.metadata.cost && (
            <div className="metadata-item">
              <span className="label">Cost:</span>
              <span className="value">
                ${response.metadata.cost.toFixed(4)}
              </span>
            </div>
          )}
        </div>
      )}

      {showMetadata && formatted?.metadata && (
        <div className="agentsea-content-metadata">
          {formatted.metadata.hasCodeBlocks && (
            <span className="badge">Code</span>
          )}
          {formatted.metadata.hasTables && (
            <span className="badge">Tables</span>
          )}
          {formatted.metadata.hasLists && <span className="badge">Lists</span>}
          {formatted.metadata.links && formatted.metadata.links.length > 0 && (
            <span className="badge">
              {formatted.metadata.links.length} Links
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Hook for formatting content on the client side
 */
export const useFormattedContent = (
  content: string,
  format?: 'text' | 'markdown' | 'html' | 'react',
) => {
  const [formatted, setFormatted] = React.useState<FormattedContent | null>(
    null,
  );

  React.useEffect(() => {
    // For client-side formatting, we'll just wrap the content
    setFormatted({
      raw: content,
      format: format || 'markdown',
      rendered: content,
    });
  }, [content, format]);

  return formatted;
};
