export const DEFAULT_INTRO_CLOUD_LENGTH = 0.3;

export type TimelineSegment = {
  index: number;
  objectId: string;
  assetId: string;
  start: number;
  end: number;
  transitionInStart: number;
  transitionInEnd: number;
  transitionInLength: number;
  peakStart: number;
  peakEnd: number;
  stayLength: number;
  transitionStart: number;
  transitionEnd: number;
  transitionOutLength: number;
};

export type TimelineState = {
  introCloudLength: number;
  totalLength: number;
  segments: TimelineSegment[];
};

export type ActiveTimelineState = {
  segmentIndex: number;
  objectId: string;
  assetId: string;
  phase: "introCloud" | "toObject" | "peak" | "toCloud";
  morph: number;
};

export type TimelineObjectInput = {
  id: string;
  assetId: string;
  enabled?: boolean;
  transitionIn?: number;
  stay?: number;
  transitionOut?: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function clampTransition(value: number | undefined): number {
  const safe = Number.isFinite(value) ? Number(value) : 0.1;
  return Math.min(1, Math.max(0, safe));
}

function clampStay(value: number | undefined): number {
  const safe = Number.isFinite(value) ? Number(value) : 0.5;
  return Math.min(2, Math.max(0, safe));
}

function findSegmentIndex(segments: TimelineSegment[], position: number): number {
  const lastIndex = segments.length - 1;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLast = i === lastIndex;
    if (position >= segment.start && (position < segment.end || isLast)) {
      return i;
    }
  }
  return lastIndex;
}

export function buildTimeline(
  storyObjects: TimelineObjectInput[],
  introCloudLength = DEFAULT_INTRO_CLOUD_LENGTH
): TimelineState {
  const intro = clampNonNegative(introCloudLength);
  const enabledObjects = storyObjects.filter((storyObject) => storyObject.enabled !== false);
  const segments: TimelineSegment[] = [];

  let cursor = intro;
  for (let index = 0; index < enabledObjects.length; index++) {
    const storyObject = enabledObjects[index];
    const transitionInLength = clampTransition(storyObject.transitionIn);
    const stayLength = clampStay(storyObject.stay);
    const transitionOutLength = clampTransition(storyObject.transitionOut);
    const transitionInStart = cursor;
    const transitionInEnd = transitionInStart + transitionInLength;
    const peakStart = transitionInEnd;
    const peakEnd = peakStart + stayLength;
    const transitionStart = peakEnd;
    const transitionEnd = transitionStart + transitionOutLength;
    const end = transitionEnd;

    segments.push({
      index,
      objectId: storyObject.id,
      assetId: storyObject.assetId,
      start: transitionInStart,
      end,
      transitionInStart,
      transitionInEnd,
      transitionInLength,
      peakStart,
      peakEnd,
      stayLength,
      transitionStart,
      transitionEnd,
      transitionOutLength,
    });

    cursor = end;
  }

  return {
    introCloudLength: intro,
    totalLength: Math.max(cursor, intro, 1e-4),
    segments,
  };
}

export function resolveTimelineState(
  timeline: TimelineState,
  position: number
): ActiveTimelineState {
  const segments = timeline.segments;
  const fallback = segments[0];

  if (segments.length === 0) {
    return {
      segmentIndex: -1,
      objectId: "",
      assetId: "",
      phase: "introCloud",
      morph: 0,
    };
  }

  const clampedPosition = Math.min(
    Math.max(0, Number.isFinite(position) ? position : 0),
    timeline.totalLength
  );

  if (clampedPosition < timeline.introCloudLength) {
    return {
      segmentIndex: 0,
      objectId: fallback.objectId,
      assetId: fallback.assetId,
      phase: "introCloud",
      morph: 0,
    };
  }

  const segmentIndex = findSegmentIndex(segments, clampedPosition);
  const segment = segments[segmentIndex];

  if (clampedPosition < segment.transitionInEnd && segment.transitionInLength > 1e-6) {
    return {
      segmentIndex,
      objectId: segment.objectId,
      assetId: segment.assetId,
      phase: "toObject",
      morph: clamp01(
        (clampedPosition - segment.transitionInStart) /
          Math.max(segment.transitionInLength, 1e-6)
      ),
    };
  }

  if (clampedPosition < segment.peakEnd) {
    return {
      segmentIndex,
      objectId: segment.objectId,
      assetId: segment.assetId,
      phase: "peak",
      morph: 0,
    };
  }

  if (segment.transitionOutLength <= 1e-6) {
    return {
      segmentIndex,
      objectId: segment.objectId,
      assetId: segment.assetId,
      phase: "peak",
      morph: 0,
    };
  }

  const transitionT = clamp01(
    (clampedPosition - segment.transitionStart) / Math.max(segment.transitionOutLength, 1e-6)
  );
  return {
    segmentIndex,
    objectId: segment.objectId,
    assetId: segment.assetId,
    phase: "toCloud",
    morph: transitionT,
  };
}
