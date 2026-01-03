/**
 * Formatting Utilities
 */

/**
 * Normalize line endings to LF
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Trim trailing whitespace from each line
 */
export function trimTrailingWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

/**
 * Normalize a template
 */
export function normalizeTemplate(template: string): string {
  let normalized = normalizeLineEndings(template);
  normalized = trimTrailingWhitespace(normalized);
  // Ensure single trailing newline
  normalized = normalized.trimEnd() + '\n';
  return normalized;
}

/**
 * Format a prompt for display
 */
export function formatPromptDisplay(
  template: string,
  options: { maxLines?: number; truncateLength?: number } = {},
): string {
  const { maxLines = 10, truncateLength = 100 } = options;

  const lines = template.split('\n');
  const displayLines = lines.slice(0, maxLines);

  if (lines.length > maxLines) {
    displayLines.push(`... (${lines.length - maxLines} more lines)`);
  }

  return displayLines
    .map((line) => {
      if (line.length > truncateLength) {
        return line.substring(0, truncateLength - 3) + '...';
      }
      return line;
    })
    .join('\n');
}

/**
 * Format a version for display
 */
export function formatVersion(version: string): string {
  if (version.startsWith('v')) {
    return version;
  }
  return `v${version}`;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  } else if (diffDay < 30) {
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  } else {
    return formatDate(date);
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Highlight variables in a template
 */
export function highlightVariables(template: string): string {
  return template.replace(/\{\{([^{}]+)\}\}/g, '\x1b[33m{{$1}}\x1b[0m');
}

/**
 * Strip ANSI color codes
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Indent text
 */
export function indent(text: string, spaces: number = 2): string {
  const indentation = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => indentation + line)
    .join('\n');
}

/**
 * Word wrap text
 */
export function wordWrap(text: string, maxWidth: number = 80): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}
