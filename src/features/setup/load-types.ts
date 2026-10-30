import type { LoadType } from "@/types/domain";

export const LOAD_TYPE_OPTIONS: {
  value: LoadType;
  title: string;
  example: string;
}[] = [
  {
    value: "total",
    title: "Total weight",
    example: "Machine stack, cable, kettlebell",
  },
  {
    value: "per_hand",
    title: "Per hand",
    example: "Dumbbells: enter one dumbbell",
  },
  {
    value: "per_side",
    title: "Per side",
    example: "Barbell or plate-loaded: enter plates on one side",
  },
  {
    value: "assisted",
    title: "Assisted",
    example: "Assisted pull-up: enter the assistance",
  },
  {
    value: "bodyweight",
    title: "Bodyweight",
    example: "Dips, pull-ups: enter added weight",
  },
];
