import type {
  ExerciseDefinition,
  TemplateDefinition,
  TemplateSetDefinition,
} from "@/types/workout";

const sets = (
  ...items: Array<[number | "AMRAP", number]>
): TemplateSetDefinition[] =>
  items.map(([target, baselineInputWeight], index) => ({
    position: index + 1,
    target:
      target === "AMRAP" ? { kind: "amrap" } : { kind: "reps", reps: target },
    baselineInputWeight,
  }));

const exercise = (
  slug: string,
  name: string,
  inputMode: ExerciseDefinition["inputMode"],
  effectiveWeightRule: ExerciseDefinition["effectiveWeightRule"],
  defaultSets: TemplateSetDefinition[],
): ExerciseDefinition => ({
  slug,
  name,
  inputMode,
  effectiveWeightRule,
  defaultSets,
});

export const exercises: ExerciseDefinition[] = [
  exercise(
    "seated-hamstring-curls",
    "Seated Hamstring Curls",
    "stack",
    "stack",
    sets([15, 80], [10, 100], [10, 120], [10, 120]),
  ),
  exercise(
    "leg-press",
    "Leg Press",
    "one_side_plates",
    "leg_press",
    sets([15, 90], [10, 135], [8, 180], [8, 180]),
  ),
  exercise(
    "hip-abductors",
    "Hip Abductors",
    "stack",
    "stack",
    sets([10, 80], [10, 100], [10, 120], [10, 120]),
  ),
  exercise(
    "dumbbell-romanian-deadlifts",
    "Dumbbell Romanian Deadlifts",
    "per_dumbbell",
    "dumbbell",
    sets([10, 60], [10, 60], [10, 60], [10, 60]),
  ),
  exercise(
    "seated-leg-extensions",
    "Seated Leg Extensions",
    "stack",
    "stack",
    sets([10, 140], [10, 180], [8, 200], ["AMRAP", 220]),
  ),
  exercise(
    "seated-angled-calf-raises",
    "Seated Angled Calf Raises",
    "stack",
    "stack",
    sets([10, 140], [10, 140], [10, 140]),
  ),
  exercise(
    "close-grip-lat-pulldown",
    "Close-Grip Lat Pulldown",
    "stack",
    "stack",
    sets([10, 100], [10, 140], [10, 160], [10, 160]),
  ),
  exercise(
    "barbell-incline-bench-press",
    "Barbell Incline Bench Press",
    "one_side_plates",
    "barbell",
    sets([10, 25], [10, 45], [8, 50], [8, 50]),
  ),
  exercise(
    "chest-supported-row",
    "Chest-Supported Row",
    "stack",
    "stack",
    sets([10, 120], [10, 140], [10, 160], [10, 160]),
  ),
  exercise(
    "pec-deck-fly",
    "Pec Deck Fly",
    "stack",
    "stack",
    sets([10, 100], [10, 160], [10, 160], [10, 160]),
  ),
  exercise(
    "reverse-pec-deck",
    "Reverse Pec Deck (Rear Delt Fly)",
    "stack",
    "stack",
    sets([10, 100], [10, 120], [10, 120], [10, 120]),
  ),
  exercise(
    "assisted-dips",
    "Assisted Dips",
    "machine_assistance",
    "assisted",
    sets([10, 120], [10, 120], [10, 120]),
  ),
  exercise(
    "standing-dumbbell-bicep-curls",
    "Standing Dumbbell Bicep Curls",
    "per_dumbbell",
    "dumbbell",
    sets([10, 25], [10, 35], [10, 35], [10, 35]),
  ),
  exercise(
    "plate-loaded-super-squats",
    "Plate Loaded Super Squats",
    "one_side_plates",
    "super_squats",
    sets([15, 45], [10, 70], [8, 95], [8, 95]),
  ),
  exercise(
    "back-extensions",
    "Back Extensions",
    "kettlebell",
    "kettlebell",
    sets([10, 0], [10, 35], [10, 0], [10, 35], [10, 0], [10, 35]),
  ),
  exercise(
    "hip-adductors",
    "Hip Adductors",
    "stack",
    "stack",
    sets([10, 80], [10, 110], [10, 120], [10, 120]),
  ),
  exercise(
    "flat-dumbbell-bench-press",
    "Flat Dumbbell Bench Press",
    "per_dumbbell",
    "dumbbell",
    sets([10, 50], [10, 65], [10, 75], [10, 75]),
  ),
  exercise(
    "assisted-pull-ups",
    "Assisted Pull-Ups",
    "machine_assistance",
    "assisted",
    sets([10, 100], [10, 100], [10, 100]),
  ),
  exercise(
    "cable-chest-fly",
    "Cable Chest Fly",
    "per_hand",
    "cable_per_hand",
    sets([10, 35], [10, 35], [10, 35]),
  ),
  exercise(
    "seated-row",
    "Seated Row",
    "stack",
    "stack",
    sets([10, 120], [10, 140], [10, 160], [10, 160]),
  ),
  exercise(
    "cable-lateral-raises",
    "Cable Lateral Raises",
    "per_arm",
    "cable_per_arm",
    sets([15, 20], [15, 20], [15, 20]),
  ),
  exercise(
    "rope-triceps-pulldowns",
    "Rope Triceps Pulldowns",
    "stack",
    "stack",
    sets([12, 65], [12, 65], [12, 65]),
  ),
  exercise(
    "seated-incline-dumbbell-curls",
    "Seated Incline Dumbbell Curls",
    "per_dumbbell",
    "dumbbell",
    sets([12, 25], [12, 25], [12, 25]),
  ),
];

export const templates: TemplateDefinition[] = [
  {
    slug: "leg-day-1",
    name: "Leg Day 1",
    kind: "lifting",
    exerciseSlugs: [
      "seated-hamstring-curls",
      "leg-press",
      "hip-abductors",
      "dumbbell-romanian-deadlifts",
      "seated-leg-extensions",
      "seated-angled-calf-raises",
    ],
  },
  {
    slug: "leg-day-2",
    name: "Leg Day 2",
    kind: "lifting",
    exerciseSlugs: [
      "seated-hamstring-curls",
      "plate-loaded-super-squats",
      "back-extensions",
      "seated-leg-extensions",
      "hip-adductors",
      "seated-angled-calf-raises",
    ],
  },
  {
    slug: "upper-day-1",
    name: "Upper Day 1",
    kind: "lifting",
    exerciseSlugs: [
      "close-grip-lat-pulldown",
      "barbell-incline-bench-press",
      "chest-supported-row",
      "pec-deck-fly",
      "reverse-pec-deck",
      "assisted-dips",
      "standing-dumbbell-bicep-curls",
    ],
  },
  {
    slug: "upper-day-2",
    name: "Upper Day 2",
    kind: "lifting",
    exerciseSlugs: [
      "flat-dumbbell-bench-press",
      "assisted-pull-ups",
      "cable-chest-fly",
      "seated-row",
      "cable-lateral-raises",
      "rope-triceps-pulldowns",
      "seated-incline-dumbbell-curls",
    ],
  },
  {
    slug: "cardio-active-recovery",
    name: "Cardio / Active Recovery",
    kind: "cardio",
    exerciseSlugs: [],
  },
];

export const exerciseBySlug = new Map(
  exercises.map((item) => [item.slug, item]),
);
export const templateBySlug = new Map(
  templates.map((item) => [item.slug, item]),
);
