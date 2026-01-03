/**
 * Type exports for @lov3kaizen/agentsea-surf
 */

// Core Surf types
export type {
  Point,
  ScreenDimensions,
  MouseButton,
  ScrollDirection,
  ModifierKey,
  ScreenshotResult,
  SandboxConfig,
  VisionConfig,
  SurfConfig,
  SurfState,
  ActionHistoryEntry,
  StreamEventType,
  BaseStreamEvent,
  ScreenshotStreamEvent,
  AnalysisStreamEvent,
  ActionStreamEvent,
  ActionResultStreamEvent,
  ThinkingStreamEvent,
  CompleteStreamEvent,
  ErrorStreamEvent,
  StreamEvent,
  ScreenAnalysis,
  UIElement,
  SuggestedAction,
  ActionResult,
} from './surf.types';

export { DEFAULT_SURF_CONFIG } from './surf.types';

// Backend types
export type {
  ScreenshotOptions,
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  DragOptions,
  DesktopBackend,
  BackendType,
  NativeBackendOptions,
  BrowserBackendOptions,
  VNCBackendOptions,
  RDPBackendOptions,
  DockerBackendOptions,
  KubernetesBackendOptions,
  BackendConfig,
  BackendFactory,
} from './backends.types';

// Action schemas and types
export {
  screenshotInputSchema,
  screenshotOutputSchema,
  clickInputSchema,
  clickOutputSchema,
  typeTextInputSchema,
  typeTextOutputSchema,
  scrollInputSchema,
  scrollOutputSchema,
  dragInputSchema,
  dragOutputSchema,
  keyPressInputSchema,
  keyPressOutputSchema,
  cursorMoveInputSchema,
  cursorMoveOutputSchema,
  waitInputSchema,
  waitOutputSchema,
} from './actions.types';

export type {
  ScreenshotInput,
  ScreenshotOutput,
  ClickInput,
  ClickOutput,
  TypeTextInput,
  TypeTextOutput,
  ScrollInput,
  ScrollOutput,
  DragInput,
  DragOutput,
  KeyPressInput,
  KeyPressOutput,
  CursorMoveInput,
  CursorMoveOutput,
  WaitInput,
  WaitOutput,
} from './actions.types';
