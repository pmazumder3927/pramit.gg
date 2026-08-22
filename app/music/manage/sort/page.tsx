import { Suspense } from "react";
import { Sorter } from "../components/Sorter";

export default function SortPage() {
  return (
    <Suspense fallback={null}>
      <Sorter />
    </Suspense>
  );
}
