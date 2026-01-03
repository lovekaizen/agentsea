/**
 * Validation Utilities
 */

import { z } from 'zod';
import type {
  VariableDefinition,
  VariableDefinitions,
} from '../types/index.js';

/**
 * Validate a prompt name
 */
export function validatePromptName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Prompt name cannot be empty' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Prompt name cannot exceed 100 characters' };
  }

  // Allow alphanumeric, hyphens, underscores
  const validPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
  if (!validPattern.test(name)) {
    return {
      valid: false,
      error:
        'Prompt name must start with a letter and contain only alphanumeric characters, hyphens, and underscores',
    };
  }

  return { valid: true };
}

/**
 * Validate a template string
 */
export function validateTemplate(template: string): {
  valid: boolean;
  error?: string;
  variables: string[];
} {
  if (!template || template.trim().length === 0) {
    return { valid: false, error: 'Template cannot be empty', variables: [] };
  }

  // Extract variables from template (Handlebars-style)
  const variablePattern = /\{\{([^{}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    const variable = match[1].trim();
    // Skip partials (starting with >)
    if (
      !variable.startsWith('>') &&
      !variable.startsWith('#') &&
      !variable.startsWith('/')
    ) {
      // Handle nested paths like user.name
      const baseName = variable.split('.')[0].split(' ')[0];
      if (baseName && !variables.includes(baseName)) {
        variables.push(baseName);
      }
    }
  }

  return { valid: true, variables };
}

/**
 * Validate variables against definitions
 */
export function validateVariables(
  variables: Record<string, unknown>,
  definitions: VariableDefinitions,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required variables
  for (const [name, def] of Object.entries(definitions)) {
    if (def.required && !(name in variables)) {
      errors.push(`Missing required variable: ${name}`);
    }
  }

  // Validate provided variables
  for (const [name, value] of Object.entries(variables)) {
    const def = definitions[name];
    if (!def) {
      // Unknown variable - warning but not error
      continue;
    }

    const typeError = validateVariableType(value, def, name);
    if (typeError) {
      errors.push(typeError);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a single variable's type
 */
function validateVariableType(
  value: unknown,
  def: VariableDefinition,
  name: string,
): string | null {
  if (value === undefined || value === null) {
    if (def.required) {
      return `Variable '${name}' is required`;
    }
    return null;
  }

  switch (def.type) {
    case 'string':
      if (typeof value !== 'string') {
        return `Variable '${name}' must be a string`;
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `Variable '${name}' must be a number`;
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Variable '${name}' must be a boolean`;
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return `Variable '${name}' must be an array`;
      }
      break;

    case 'enum':
      if (def.values && !def.values.includes(String(value))) {
        return `Variable '${name}' must be one of: ${def.values.join(', ')}`;
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return `Variable '${name}' must be an object`;
      }
      break;
  }

  // Use Zod validation if provided
  if (def.validation) {
    const result = def.validation.safeParse(value);
    if (!result.success) {
      return `Variable '${name}' validation failed: ${result.error.message}`;
    }
  }

  return null;
}

/**
 * Create a Zod schema from variable definitions
 */
export function createVariableSchema(
  definitions: VariableDefinitions,
): z.ZodSchema {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [name, def] of Object.entries(definitions)) {
    let schema: z.ZodTypeAny;

    switch (def.type) {
      case 'string':
        schema = z.string();
        break;
      case 'number':
        schema = z.number();
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'array':
        schema = z.array(z.unknown());
        break;
      case 'enum':
        if (def.values && def.values.length > 0) {
          schema = z.enum(def.values as [string, ...string[]]);
        } else {
          schema = z.string();
        }
        break;
      case 'object':
        schema = z.record(z.unknown());
        break;
      default:
        schema = z.unknown();
    }

    if (!def.required) {
      schema = schema.optional();
    }

    if (def.default !== undefined) {
      schema = schema.default(def.default);
    }

    shape[name] = schema;
  }

  return z.object(shape);
}

/**
 * Validate branch name
 */
export function validateBranchName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Branch name cannot be empty' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Branch name cannot exceed 100 characters' };
  }

  // Allow alphanumeric, hyphens, underscores, and slashes (for feature/xxx style)
  const validPattern = /^[a-zA-Z][a-zA-Z0-9_/-]*$/;
  if (!validPattern.test(name)) {
    return {
      valid: false,
      error:
        'Branch name must start with a letter and contain only alphanumeric characters, hyphens, underscores, and slashes',
    };
  }

  // Reserved names
  const reserved = ['main', 'master', 'head'];
  if (reserved.includes(name.toLowerCase())) {
    return { valid: false, error: `'${name}' is a reserved branch name` };
  }

  return { valid: true };
}

/**
 * Validate environment name
 */
export function validateEnvironmentName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Environment name cannot be empty' };
  }

  if (name.length > 50) {
    return {
      valid: false,
      error: 'Environment name cannot exceed 50 characters',
    };
  }

  const validPattern = /^[a-z][a-z0-9_-]*$/;
  if (!validPattern.test(name)) {
    return {
      valid: false,
      error:
        'Environment name must be lowercase and contain only alphanumeric characters, hyphens, and underscores',
    };
  }

  return { valid: true };
}
