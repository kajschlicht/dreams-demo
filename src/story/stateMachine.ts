export type ExperienceState =
  | "intro"
  | "scriptInput"
  | "paramReview"
  | "approach"
  | "build"
  | "transform"
  | "rehearse"
  | "coolDown";

export type ExperienceEvent =
  | { type: "START" }
  | { type: "SUBMIT_SCRIPT"; script: string }
  | { type: "CONFIRM_PARAMS" }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "EXIT" }
  | { type: "PANIC" }
  | { type: "RESET" };

export function nextState(
  current: ExperienceState,
  event: ExperienceEvent
): ExperienceState {
  if (event.type === "RESET") return "intro";
  if (event.type === "PANIC" || event.type === "EXIT") return "coolDown";

  switch (current) {
    case "intro":
      if (event.type === "START") return "scriptInput";
      return current;

    case "scriptInput":
      if (event.type === "SUBMIT_SCRIPT") return "paramReview";
      if (event.type === "BACK") return "intro";
      return current;

    case "paramReview":
      if (event.type === "CONFIRM_PARAMS") return "approach";
      if (event.type === "BACK") return "scriptInput";
      return current;

    case "approach":
      if (event.type === "NEXT") return "build";
      if (event.type === "BACK") return "paramReview";
      return current;

    case "build":
      if (event.type === "NEXT") return "transform";
      if (event.type === "BACK") return "approach";
      return current;

    case "transform":
      if (event.type === "NEXT") return "rehearse";
      if (event.type === "BACK") return "build";
      return current;

    case "rehearse":
      if (event.type === "NEXT") return "coolDown";
      if (event.type === "BACK") return "transform";
      return current;

    case "coolDown":
      if (event.type === "START") return "scriptInput";
      return current;

    default:
      return current;
  }
}