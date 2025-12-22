/**
 * Recording Exports
 */

export { Recorder, createRecorder, type RecorderEvents } from './Recorder.js';

export {
  SnapshotManager,
  createSnapshotManager,
  type SnapshotOptions,
  type IncrementalSnapshot,
} from './Snapshot.js';

export {
  CheckpointManager,
  createCheckpointManager,
  type CheckpointCreateOptions,
  type CheckpointFilterOptions,
} from './Checkpoint.js';

export {
  Timeline,
  createTimeline,
  type TimelineEventOptions,
  type TimelineMarker,
  type TimelineSegment,
  type TimelineFilterOptions,
  type TimelineStats,
} from './Timeline.js';
