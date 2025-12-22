/**
 * Incremental JSON Parser
 *
 * Parses JSON incrementally as it streams in, emitting field updates.
 */

import type { JsonToken, ParserState } from '../types/streaming.types.js';

/**
 * Field update from parser
 */
export interface FieldParseUpdate {
  path: string[];
  value: unknown;
  complete: boolean;
}

/**
 * Incremental JSON parser for streaming responses
 */
export class IncrementalJsonParser {
  private state: ParserState;
  private result: Record<string, unknown>;
  private pendingUpdates: FieldParseUpdate[];

  constructor() {
    this.state = this.createInitialState();
    this.result = {};
    this.pendingUpdates = [];
  }

  /**
   * Feed a chunk of text to the parser
   */
  feed(chunk: string): FieldParseUpdate[] {
    this.pendingUpdates = [];
    this.state.buffer += chunk;

    this.parse();

    return this.pendingUpdates;
  }

  /**
   * Get the current parsed result
   */
  getResult(): Record<string, unknown> {
    // Try to complete any pending parsing
    this.finalize();
    return this.result;
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.state = this.createInitialState();
    this.result = {};
    this.pendingUpdates = [];
  }

  /**
   * Create initial parser state
   */
  private createInitialState(): ParserState {
    return {
      currentPath: [],
      depth: 0,
      buffer: '',
      partial: {},
      inString: false,
      inEscape: false,
      currentString: '',
      currentKey: null,
      containerStack: [],
    };
  }

  /**
   * Parse the current buffer
   */
  private parse(): void {
    let i = 0;
    let lastSuccessfulIndex = -1;

    while (i < this.state.buffer.length) {
      const char = this.state.buffer[i];

      if (this.state.inString) {
        i = this.parseStringChar(i, char);
        lastSuccessfulIndex = i;
      } else {
        // Check for potentially incomplete values BEFORE parsing them
        // Check for incomplete boolean/null
        if (char === 't' || char === 'f' || char === 'n') {
          const remaining = this.state.buffer.slice(i);
          const isComplete =
            remaining.startsWith('true') ||
            remaining.startsWith('false') ||
            remaining.startsWith('null');
          if (!isComplete) {
            // Incomplete literal - keep in buffer
            break;
          }
        }

        // Check for potentially incomplete number
        if (/[-\d]/.test(char)) {
          const remaining = this.state.buffer.slice(i);
          // Find where the number ends
          const match = remaining.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
          if (match) {
            const numStr = match[0];
            // Check if there's a terminator after the number
            const afterNum = remaining.slice(numStr.length);
            if (
              afterNum.length === 0 ||
              (afterNum.length > 0 && !/[\s,}]/.test(afterNum[0]))
            ) {
              // Number goes to end of buffer without terminator - might be incomplete
              break;
            }
          }
        }

        i = this.parseChar(i, char);
        lastSuccessfulIndex = i;
      }

      i++;
    }

    // Only clear the successfully processed part of the buffer
    if (lastSuccessfulIndex >= 0) {
      this.state.buffer = this.state.buffer.slice(lastSuccessfulIndex + 1);
    }
  }

  /**
   * Parse a character inside a string
   */
  private parseStringChar(index: number, char: string): number {
    if (this.state.inEscape) {
      this.state.currentString += this.processEscape(char);
      this.state.inEscape = false;
      return index;
    }

    if (char === '\\') {
      this.state.inEscape = true;
      return index;
    }

    if (char === '"') {
      this.state.inString = false;
      this.handleStringComplete();
      return index;
    }

    this.state.currentString += char;
    return index;
  }

  /**
   * Parse a character outside a string
   */
  private parseChar(index: number, char: string): number {
    // Skip whitespace
    if (/\s/.test(char)) {
      return index;
    }

    switch (char) {
      case '{':
        this.handleObjectStart();
        break;

      case '}':
        this.handleObjectEnd();
        break;

      case '[':
        this.handleArrayStart();
        break;

      case ']':
        this.handleArrayEnd();
        break;

      case '"':
        this.state.inString = true;
        this.state.currentString = '';
        break;

      case ':':
        // Colon after key, nothing special to do
        break;

      case ',':
        // Comma between values, reset current key if in object
        if (this.getCurrentContainer() === 'object') {
          this.state.currentKey = null;
        } else if (this.getCurrentContainer() === 'array') {
          // Increment array index
          const lastPath =
            this.state.currentPath[this.state.currentPath.length - 1];
          if (typeof lastPath === 'string' && /^\d+$/.test(lastPath)) {
            this.state.currentPath[this.state.currentPath.length - 1] = String(
              parseInt(lastPath, 10) + 1,
            );
          }
        }
        break;

      case 't':
      case 'f':
        index = this.parseBoolean(index);
        break;

      case 'n':
        index = this.parseNull(index);
        break;

      default:
        if (/[-\d]/.test(char)) {
          index = this.parseNumber(index);
        }
    }

    return index;
  }

  /**
   * Process an escape character
   */
  private processEscape(char: string): string {
    switch (char) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case '\\':
        return '\\';
      case '"':
        return '"';
      case '/':
        return '/';
      default:
        return char;
    }
  }

  /**
   * Handle completion of a string
   */
  private handleStringComplete(): void {
    const value = this.state.currentString;

    if (
      this.getCurrentContainer() === 'object' &&
      this.state.currentKey === null
    ) {
      // This is a key
      this.state.currentKey = value;
    } else {
      // This is a value
      this.setValue(value);
    }
  }

  /**
   * Handle start of object
   */
  private handleObjectStart(): void {
    this.state.depth++;
    this.state.containerStack.push('object');

    if (this.state.currentKey !== null) {
      this.state.currentPath.push(this.state.currentKey);
      this.state.currentKey = null;
    }
    // If parent is array, path already has the index - don't modify it

    this.setNestedValue(this.result, this.state.currentPath, {});
  }

  /**
   * Handle end of object
   */
  private handleObjectEnd(): void {
    this.state.depth--;
    this.state.containerStack.pop();

    // Emit object complete event
    const path = [...this.state.currentPath];
    const value = this.getNestedValue(this.result, path);

    this.pendingUpdates.push({
      path,
      value,
      complete: true,
    });

    // Only pop if we're not inside an array (array manages its own indices)
    // Check what the NEW current container is after popping 'object'
    const currentContainer = this.getCurrentContainer();
    if (currentContainer !== 'array' && this.state.currentPath.length > 0) {
      this.state.currentPath.pop();
    }
  }

  /**
   * Handle start of array
   */
  private handleArrayStart(): void {
    this.state.depth++;
    this.state.containerStack.push('array');

    if (this.state.currentKey !== null) {
      this.state.currentPath.push(this.state.currentKey);
      this.state.currentKey = null;
    }
    // If parent is array, path already has the index

    this.setNestedValue(this.result, this.state.currentPath, []);
    this.state.currentPath.push('0'); // Start at index 0
  }

  /**
   * Handle end of array
   */
  private handleArrayEnd(): void {
    this.state.depth--;
    this.state.containerStack.pop();

    // Remove array index from path
    this.state.currentPath.pop();

    // Emit array complete event
    const path = [...this.state.currentPath];
    const value = this.getNestedValue(this.result, path);

    this.pendingUpdates.push({
      path,
      value,
      complete: true,
    });

    // Only pop the array's key if we're not inside another array
    const currentContainer = this.getCurrentContainer();
    if (currentContainer !== 'array' && this.state.currentPath.length > 0) {
      this.state.currentPath.pop();
    }
  }

  /**
   * Parse a boolean value
   */
  private parseBoolean(startIndex: number): number {
    const remaining = this.state.buffer.slice(startIndex);

    if (remaining.startsWith('true')) {
      this.setValue(true);
      return startIndex + 3; // 4 - 1 for the loop increment
    }

    if (remaining.startsWith('false')) {
      this.setValue(false);
      return startIndex + 4; // 5 - 1 for the loop increment
    }

    // Incomplete boolean, wait for more data
    return startIndex;
  }

  /**
   * Parse a null value
   */
  private parseNull(startIndex: number): number {
    const remaining = this.state.buffer.slice(startIndex);

    if (remaining.startsWith('null')) {
      this.setValue(null);
      return startIndex + 3; // 4 - 1 for the loop increment
    }

    // Incomplete null, wait for more data
    return startIndex;
  }

  /**
   * Parse a number value
   */
  private parseNumber(startIndex: number): number {
    const remaining = this.state.buffer.slice(startIndex);
    const match = remaining.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);

    if (match) {
      const numStr = match[0];
      const value =
        numStr.includes('.') || numStr.includes('e') || numStr.includes('E')
          ? parseFloat(numStr)
          : parseInt(numStr, 10);

      this.setValue(value);
      return startIndex + numStr.length - 1;
    }

    return startIndex;
  }

  /**
   * Set a value at the current path
   */
  private setValue(value: unknown): void {
    let path: string[];

    if (this.state.currentKey !== null) {
      path = [...this.state.currentPath, this.state.currentKey];
      this.state.currentKey = null;
    } else if (this.getCurrentContainer() === 'array') {
      path = [...this.state.currentPath];
    } else {
      path = [...this.state.currentPath];
    }

    this.setNestedValue(this.result, path, value);

    this.pendingUpdates.push({
      path,
      value,
      complete: true,
    });
  }

  /**
   * Get current container type
   */
  private getCurrentContainer(): 'object' | 'array' | null {
    if (this.state.containerStack.length === 0) {
      return null;
    }
    return this.state.containerStack[this.state.containerStack.length - 1];
  }

  /**
   * Set a nested value in an object
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string[],
    value: unknown,
  ): void {
    if (path.length === 0) {
      return;
    }

    let current: unknown = obj;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];

      if (typeof current !== 'object' || current === null) {
        return;
      }

      const currentObj = current as Record<string, unknown>;

      if (!(key in currentObj)) {
        const nextKey = path[i + 1];
        currentObj[key] = /^\d+$/.test(nextKey) ? [] : {};
      }

      current = currentObj[key];
    }

    const lastKey = path[path.length - 1];
    if (typeof current === 'object' && current !== null) {
      (current as Record<string, unknown>)[lastKey] = value;
    }
  }

  /**
   * Get a nested value from an object
   */
  private getNestedValue(
    obj: Record<string, unknown>,
    path: string[],
  ): unknown {
    if (path.length === 0) {
      return obj;
    }

    let current: unknown = obj;

    for (const key of path) {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /**
   * Finalize parsing - try to complete any partial values
   */
  private finalize(): void {
    // If there's remaining buffer, try to parse as JSON
    if (this.state.buffer.trim()) {
      try {
        const parsed = JSON.parse(this.state.buffer);
        this.result = parsed;
      } catch {
        // Incomplete JSON, use what we have
      }
    }
  }
}

/**
 * Process an escape sequence character
 */
function processEscapeChar(char: string): string {
  switch (char) {
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case '\\':
      return '\\';
    case '"':
      return '"';
    case '/':
      return '/';
    case 'b':
      return '\b';
    case 'f':
      return '\f';
    default:
      return char;
  }
}

/**
 * Tokenize a JSON string (utility for debugging)
 */
export function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const path: string[] = [];
  let inString = false;
  let inEscape = false;
  let currentString = '';
  let currentKey: string | null = null;

  for (let i = 0; i < json.length; i++) {
    const char = json[i];

    if (inString) {
      if (inEscape) {
        // Process escape sequence
        currentString += processEscapeChar(char);
        inEscape = false;
      } else if (char === '\\') {
        inEscape = true;
      } else if (char === '"') {
        inString = false;
        tokens.push({
          type: currentKey === null ? 'key' : 'string',
          value: currentString,
          path: [...path],
          complete: true,
        });
        if (currentKey === null) {
          currentKey = currentString;
        }
        currentString = '';
      } else {
        currentString += char;
      }
    } else if (/\s/.test(char)) {
      continue;
    } else if (char === '{') {
      tokens.push({
        type: 'object_start',
        value: '{',
        path: [...path],
        complete: true,
      });
    } else if (char === '}') {
      tokens.push({
        type: 'object_end',
        value: '}',
        path: [...path],
        complete: true,
      });
      path.pop();
      currentKey = null;
    } else if (char === '[') {
      tokens.push({
        type: 'array_start',
        value: '[',
        path: [...path],
        complete: true,
      });
    } else if (char === ']') {
      tokens.push({
        type: 'array_end',
        value: ']',
        path: [...path],
        complete: true,
      });
    } else if (char === ':') {
      tokens.push({
        type: 'colon',
        value: ':',
        path: [...path],
        complete: true,
      });
      if (currentKey) {
        path.push(currentKey);
      }
    } else if (char === ',') {
      tokens.push({
        type: 'comma',
        value: ',',
        path: [...path],
        complete: true,
      });
      path.pop();
      currentKey = null;
    } else if (char === '"') {
      inString = true;
      currentString = '';
    }
  }

  return tokens;
}
