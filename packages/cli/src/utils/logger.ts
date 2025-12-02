import chalk from 'chalk';

/**
 * Logger utility for consistent CLI output
 */
export class Logger {
  /**
   * Log success message
   */
  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error): void {
    console.error(chalk.red('✗'), message);
    if (error && error.message) {
      console.error(chalk.red('  Error:'), error.message);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  /**
   * Log info message
   */
  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Log a message without any prefix
   */
  log(message: string): void {
    console.log(message);
  }

  /**
   * Log a heading
   */
  heading(message: string): void {
    console.log(chalk.bold.cyan(`\n${message}\n`));
  }

  /**
   * Log a subheading
   */
  subheading(message: string): void {
    console.log(chalk.bold(`\n${message}`));
  }

  /**
   * Log a key-value pair
   */
  keyValue(key: string, value: string): void {
    console.log(chalk.gray(`  ${key}:`), value);
  }

  /**
   * Log a divider
   */
  divider(): void {
    console.log(chalk.gray('─'.repeat(50)));
  }

  /**
   * Log a blank line
   */
  blank(): void {
    console.log();
  }

  /**
   * Log code block
   */
  code(code: string): void {
    console.log(chalk.gray(code));
  }

  /**
   * Log a list item
   */
  listItem(item: string): void {
    console.log(chalk.gray('  •'), item);
  }

  /**
   * Log JSON with syntax highlighting
   */
  json(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  }

  /**
   * Clear the console
   */
  clear(): void {
    console.clear();
  }

  /**
   * Log debug message (only in verbose mode)
   */
  debug(message: string, verbose?: boolean): void {
    if (verbose) {
      console.log(chalk.gray('[DEBUG]'), message);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
