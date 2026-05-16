import EditorShell from "@/components/EditorShell";
import { Suspense } from "react";

export default function EditorPage() {
  return (
    <Suspense>
      <EditorShell />
    </Suspense>
  );
}
