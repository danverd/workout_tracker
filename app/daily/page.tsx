import DailyClient from "@/components/daily/DailyClient";
import { todayInNewYork } from "@/lib/dates";
export default function DailyPage() {
  return <DailyClient initialDate={todayInNewYork()} />;
}
