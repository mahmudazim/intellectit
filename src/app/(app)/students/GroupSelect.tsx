"use client";

import { useRef } from "react";
import { setStudentGroupAction } from "./actions";

type Group = { id: string; name: string };

/** Guruhni tanlash — o'zgarganda avtomatik saqlanadi (alohida tugma kerak emas). */
export function GroupSelect({
  userId,
  groups,
  currentGroupId,
}: {
  userId: string;
  groups: Group[];
  currentGroupId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setStudentGroupAction}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="groupId"
        defaultValue={currentGroupId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Guruh"
        className="h-9 max-w-[10rem] rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">Guruhsiz</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </form>
  );
}
