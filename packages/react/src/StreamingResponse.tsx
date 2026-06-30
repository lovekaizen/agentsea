import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { StreamEvent } from '@lov3kaizen/agentsea-core';

export interface StreamingResponseProps {
  stream: AsyncIterable<StreamEvent>;
  className?: string;
  showMetadata?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  onComplete?: (content: string) => void;
}

/**
 * Component for rendering streaming agent responses
 */
export const StreamingResponse: React.FC<StreamingResponseProps> = ({
  stream,
  className = '',
  showMetadata = false,
  theme = 'auto',
  onComplete,
}) => {
  const [content, setContent] = React.useState('');
  const [metadata, setMetadata] = React.useState<any>(null);
  const [isComplete, setIsComplete] = React.useState(false);
  const [currentIteration, setCurrentIteration] = React.useState(0);

  // Keep the latest onComplete without making it (or `content`) an effect
  // dependency — otherwise the stream would be torn down and re-subscribed on
  // every chunk, replaying the async iterator from the start.
  const onCompleteRef = React.useRef(onComplete);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  React.useEffect(() => {
    let isMounted = true;
    // Track accumulated content locally so `done` reports the final value
    // instead of a stale closure over the `content` state.
    let accumulated = '';
    const consumeStream = async () => {
      try {
        for await (const event of stream) {
          if (!isMounted) break;

          switch (event.type) {
            case 'iteration':
              setCurrentIteration(event.iteration);
              break;
            case 'content':
              if (event.delta) {
                accumulated += event.content || '';
              } else {
                accumulated = event.content || '';
              }
              setContent(accumulated);
              break;
            case 'done':
              setMetadata(event.metadata);
              setIsComplete(true);
              onCompleteRef.current?.(accumulated);
              break;
            case 'error':
              console.error('Stream error:', event.error);
              break;
          }
        }
      } catch (error) {
        console.error('Error consuming stream:', error);
      }
    };

    consumeStream();

    return () => {
      isMounted = false;
    };
  }, [stream]);

  return (
    <div
      className={`agentsea-streaming-response ${className}`}
      data-theme={theme}
    >
      {!isComplete && showMetadata && (
        <div className="streaming-indicator">
          <span className="spinner" />
          <span>Iteration {currentIteration}</span>
        </div>
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>

      {!isComplete && <span className="cursor">▊</span>}

      {isComplete && showMetadata && metadata && (
        <div className="agentsea-metadata">
          {metadata.tokensUsed && (
            <div className="metadata-item">
              <span className="label">Tokens:</span>
              <span className="value">{metadata.tokensUsed}</span>
            </div>
          )}
          {metadata.latencyMs && (
            <div className="metadata-item">
              <span className="label">Latency:</span>
              <span className="value">{metadata.latencyMs}ms</span>
            </div>
          )}
          {metadata.iterations && (
            <div className="metadata-item">
              <span className="label">Iterations:</span>
              <span className="value">{metadata.iterations}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Hook for managing streaming content
 */
export const useStreamingContent = () => {
  const [content, setContent] = React.useState('');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [metadata, setMetadata] = React.useState<any>(null);

  const consumeStream = React.useCallback(
    async (stream: AsyncIterable<StreamEvent>) => {
      setIsStreaming(true);
      setContent('');
      setMetadata(null);

      try {
        for await (const event of stream) {
          switch (event.type) {
            case 'content':
              if (event.delta) {
                setContent((prev) => prev + (event.content || ''));
              } else {
                setContent(event.content || '');
              }
              break;
            case 'done':
              setMetadata(event.metadata);
              setIsStreaming(false);
              break;
            case 'error':
              console.error('Stream error:', event.error);
              setIsStreaming(false);
              break;
          }
        }
      } catch (error) {
        console.error('Error consuming stream:', error);
        setIsStreaming(false);
      }
    },
    [],
  );

  return {
    content,
    isStreaming,
    metadata,
    consumeStream,
  };
};
