import { describe, it, expect, beforeEach } from 'vitest';
import { CodeChunker, createCodeChunker } from '../chunking/CodeChunker.js';

describe('CodeChunker', () => {
  let chunker: CodeChunker;

  beforeEach(() => {
    chunker = new CodeChunker();
  });

  describe('constructor', () => {
    it('should create a code chunker', () => {
      expect(chunker).toBeInstanceOf(CodeChunker);
      expect(chunker.strategyType).toBe('code');
    });
  });

  describe('chunk - TypeScript', () => {
    it('should chunk TypeScript functions', async () => {
      const code = `
import { something } from 'module';

function functionOne() {
  return 'one';
}

function functionTwo() {
  return 'two';
}

export function functionThree() {
  return 'three';
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        language: 'typescript',
        splitBy: 'function',
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.metadata.language).toBe('typescript');
      });
    });

    it('should chunk TypeScript classes', async () => {
      const code = `
export class ClassOne {
  method() {
    return 'one';
  }
}

class ClassTwo {
  method() {
    return 'two';
  }
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        language: 'typescript',
        splitBy: 'class',
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.metadata.blockType).toBeDefined();
      });
    });

    it('should include imports when specified', async () => {
      const code = `
import { test } from 'module';

function myFunction() {
  return test();
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 200,
        chunkOverlap: 0,
        language: 'typescript',
        includeImports: true,
      });

      // At least one chunk should contain the import
      const hasImport = chunks.some((chunk) => chunk.text.includes('import'));
      expect(hasImport).toBe(true);
    });

    it('should exclude imports when specified', async () => {
      const code = `
import { test } from 'module';

function myFunction() {
  return test();
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 200,
        chunkOverlap: 0,
        language: 'typescript',
        includeImports: false,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle arrow functions', async () => {
      const code = `
export const arrowOne = () => {
  return 'one';
};

const arrowTwo = async (param) => {
  return param;
};
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        language: 'typescript',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle interfaces and types', async () => {
      const code = `
interface TestInterface {
  field: string;
}

type TestType = {
  value: number;
};
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        language: 'typescript',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('chunk - JavaScript', () => {
    it('should chunk JavaScript functions', async () => {
      const code = `
const helper = require('./helper');

function main() {
  return helper.doSomething();
}

module.exports = { main };
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        language: 'javascript',
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.metadata.language).toBe('javascript');
      });
    });

    it('should handle ES6 syntax', async () => {
      const code = `
import Module from 'module';

class MyClass {
  constructor() {
    this.value = 0;
  }
}

export default MyClass;
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 150,
        chunkOverlap: 0,
        language: 'javascript',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('chunk - Python', () => {
    it('should chunk Python functions', async () => {
      const code = `
from module import something

def function_one():
    return "one"

def function_two():
    return "two"

async def async_function():
    return await something()
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        language: 'python',
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.metadata.language).toBe('python');
      });
    });

    it('should chunk Python classes', async () => {
      const code = `
class MyClass:
    def __init__(self):
        self.value = 0

    def method(self):
        return self.value
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        language: 'python',
        splitBy: 'class',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('chunk - Go', () => {
    it('should chunk Go functions', async () => {
      const code = `
package main

import "fmt"

func main() {
    fmt.Println("Hello")
}

func helper() string {
    return "helper"
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        language: 'go',
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.metadata.language).toBe('go');
      });
    });

    it('should chunk Go structs', async () => {
      const code = `
type Person struct {
    Name string
    Age  int
}

type Company struct {
    Name string
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        language: 'go',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('chunk - Rust', () => {
    it('should chunk Rust functions', async () => {
      const code = `
use std::io;

pub fn public_function() -> i32 {
    42
}

fn private_function() {
    println!("private");
}

pub async fn async_function() {
    // async code
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        language: 'rust',
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.metadata.language).toBe('rust');
      });
    });

    it('should chunk Rust structs and implementations', async () => {
      const code = `
pub struct MyStruct {
    field: i32,
}

impl MyStruct {
    pub fn new() -> Self {
        MyStruct { field: 0 }
    }
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 150,
        chunkOverlap: 0,
        language: 'rust',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript', async () => {
      const code = `
interface Config {
  value: string;
}

const config: Config = { value: 'test' };
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks[0].metadata.language).toBe('typescript');
    });

    it('should detect Python', async () => {
      const code = `
def my_function():
    return "test"
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks[0].metadata.language).toBe('python');
    });

    it('should detect Go', async () => {
      const code = `
package main

func main() {
    // code
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks[0].metadata.language).toBe('go');
    });

    it('should detect Rust', async () => {
      const code = `
pub fn test() {
    let mut x = 5;
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks[0].metadata.language).toBe('rust');
    });

    it('should detect JavaScript', async () => {
      const code = `
const value = 5;
function test() {
  require('module');
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks[0].metadata.language).toBe('javascript');
    });

    it('should default to TypeScript', async () => {
      const code = `
const x = 1;
const y = 2;
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks[0].metadata.language).toBe('typescript');
    });
  });

  describe('comments handling', () => {
    it('should include comments when specified', async () => {
      const code = `
// This is a comment
function test() {
  /* Multi-line
     comment */
  return 1;
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 150,
        chunkOverlap: 0,
        includeComments: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should exclude comments when specified', async () => {
      const code = `
// This is a comment
function test() {
  return 1;
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 150,
        chunkOverlap: 0,
        includeComments: false,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('large blocks', () => {
    it('should split large functions', async () => {
      const code = `
function largeFunction() {
  const line1 = 1;
  const line2 = 2;
  const line3 = 3;
  const line4 = 4;
  const line5 = 5;
  const line6 = 6;
  const line7 = 7;
  const line8 = 8;
  const line9 = 9;
  const line10 = 10;
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 20,
        chunkOverlap: 0,
        language: 'javascript',
      });

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.metadata.blockType).toBeDefined();
      });
    });

    it('should mark partial chunks', async () => {
      const code = `
function veryLargeFunction() {
  ${'const line = 1;\n'.repeat(50)}
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 30,
        chunkOverlap: 0,
      });

      const partialChunks = chunks.filter(
        (chunk) => chunk.metadata.partial === true,
      );
      expect(partialChunks.length).toBeGreaterThan(0);
    });
  });

  describe('splitBy option', () => {
    it('should split by function', async () => {
      const code = `
function one() {}
class Two {}
function three() {}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        splitBy: 'function',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should split by class', async () => {
      const code = `
class One {}
function two() {}
class Three {}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        splitBy: 'class',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should auto split', async () => {
      const code = `
function func() {}
class Class {}
const other = 1;
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        splitBy: 'auto',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('metadata', () => {
    it('should include block type in metadata', async () => {
      const code = `
function test() {
  return 1;
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks[0].metadata.blockType).toBeDefined();
    });

    it('should include block name in metadata', async () => {
      const code = `
function namedFunction() {
  return 1;
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks[0].metadata.blockName).toBeDefined();
    });

    it('should include custom metadata', async () => {
      const code = `
function test() {}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
        metadata: { custom: 'value' },
      });

      expect(chunks[0].metadata.custom).toBe('value');
    });
  });

  describe('edge cases', () => {
    it('should handle empty code', async () => {
      const chunks = await chunker.chunk('', {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks).toHaveLength(0);
    });

    it('should handle whitespace-only code', async () => {
      const chunks = await chunker.chunk('   \n\n   ', {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks).toHaveLength(0);
    });

    it('should handle code without functions or classes', async () => {
      const code = `
const x = 1;
const y = 2;
console.log(x + y);
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle nested functions', async () => {
      const code = `
function outer() {
  function inner() {
    return 1;
  }
  return inner();
}
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle mixed content', async () => {
      const code = `
import { test } from 'module';

const config = { value: 1 };

function helper() {}

class MyClass {}

export { config, helper };
`;

      const chunks = await chunker.chunk(code, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('createCodeChunker factory', () => {
    it('should create a chunker instance', () => {
      const factoryChunker = createCodeChunker();
      expect(factoryChunker).toBeInstanceOf(CodeChunker);
    });
  });
});
